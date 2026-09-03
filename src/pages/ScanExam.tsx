import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Cropper, { type Area } from 'react-easy-crop'
import { supabase } from '../lib/supabase'
import { decodeQrFromDataUrl, getCroppedImageDataUrl } from '../lib/cropImage'
import { recognizeText } from '../lib/ocr'
import type { Appello, Course, ExamQrPayload, Student } from '../types'

type Step = 'capture' | 'identify' | 'crop-name' | 'crop-grade' | 'confirm' | 'done'

const STEPS: Step[] = ['capture', 'identify', 'crop-name', 'crop-grade', 'confirm']
const LETTER_WHITELIST = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ '
const DIGIT_WHITELIST = '0123456789'

export default function ScanExam() {
  const [params] = useSearchParams()

  const [step, setStep] = useState<Step>('capture')
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null)

  const [courseId, setCourseId] = useState<string | null>(params.get('courseId'))
  const [appelloId, setAppelloId] = useState<string | null>(params.get('appelloId'))
  const [course, setCourse] = useState<Course | null>(null)
  const [appello, setAppello] = useState<Appello | null>(null)
  const [qrFound, setQrFound] = useState(false)

  const [allCourses, setAllCourses] = useState<Course[]>([])
  const [courseAppelli, setCourseAppelli] = useState<Appello[]>([])
  const [students, setStudents] = useState<Student[]>([])

  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedArea, setCroppedArea] = useState<Area | null>(null)

  const [ocrProgress, setOcrProgress] = useState(0)
  const [ocrBusy, setOcrBusy] = useState(false)

  const [cognome, setCognome] = useState('')
  const [nome, setNome] = useState('')
  const [voto, setVoto] = useState('')
  const [lode, setLode] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Carica corso/appello noti (da QR o da query string)
  useEffect(() => {
    async function loadKnown() {
      if (courseId) {
        const { data } = await supabase.from('courses').select('*').eq('id', courseId).single()
        setCourse((data as Course) ?? null)
      }
      if (appelloId) {
        const { data } = await supabase.from('appelli').select('*').eq('id', appelloId).single()
        setAppello((data as Appello) ?? null)
      }
    }
    loadKnown()
  }, [courseId, appelloId])

  // Se manca corso/appello, carica elenco corsi per la selezione manuale
  useEffect(() => {
    if (courseId) return
    supabase
      .from('courses')
      .select('*')
      .order('anno_accademico', { ascending: false })
      .then(({ data }) => setAllCourses((data as Course[]) ?? []))
  }, [courseId])

  useEffect(() => {
    if (!courseId) return
    supabase
      .from('appelli')
      .select('*')
      .eq('course_id', courseId)
      .order('data', { ascending: false })
      .then(({ data }) => setCourseAppelli((data as Appello[]) ?? []))
  }, [courseId])

  useEffect(() => {
    if (!courseId) return
    supabase
      .from('students')
      .select('*')
      .eq('course_id', courseId)
      .then(({ data }) => setStudents((data as Student[]) ?? []))
  }, [courseId])

  const stepIndex = STEPS.indexOf(step === 'done' ? 'confirm' : step)

  async function handleFile(file: File) {
    const reader = new FileReader()
    reader.onload = async () => {
      const dataUrl = reader.result as string
      setPhotoDataUrl(dataUrl)
      setStep('identify')
      const qrText = await decodeQrFromDataUrl(dataUrl)
      if (qrText) {
        try {
          const payload = JSON.parse(qrText) as ExamQrPayload
          if (payload.app === 'gestore-esami' && payload.courseId && payload.appelloId) {
            setCourseId(payload.courseId)
            setAppelloId(payload.appelloId)
            setQrFound(true)
          }
        } catch {
          // QR non compatibile: si procede con selezione manuale
        }
      }
    }
    reader.readAsDataURL(file)
  }

  function resetCrop() {
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setCroppedArea(null)
  }

  async function confirmNameCrop() {
    if (!photoDataUrl || !croppedArea) return
    setOcrBusy(true)
    setOcrProgress(0)
    try {
      const cropped = await getCroppedImageDataUrl(photoDataUrl, croppedArea)
      const text = await recognizeText(
        cropped,
        { whitelist: LETTER_WHITELIST, lang: 'ita', singleLine: true },
        (p) => setOcrProgress(p)
      )
      const cleaned = text.replace(/\s+/g, ' ').trim()
      const parts = cleaned.split(' ').filter(Boolean)
      setCognome(parts[0] ?? '')
      setNome(parts.slice(1).join(' '))
    } finally {
      setOcrBusy(false)
      resetCrop()
      setStep('crop-grade')
    }
  }

  async function confirmGradeCrop() {
    if (!photoDataUrl || !croppedArea) return
    setOcrBusy(true)
    setOcrProgress(0)
    try {
      const cropped = await getCroppedImageDataUrl(photoDataUrl, croppedArea)
      const text = await recognizeText(
        cropped,
        { whitelist: DIGIT_WHITELIST, lang: 'eng', singleLine: true },
        (p) => setOcrProgress(p)
      )
      const digits = text.replace(/\D/g, '')
      setVoto(digits ? digits.slice(0, 2) : '')
    } finally {
      setOcrBusy(false)
      resetCrop()
      setStep('confirm')
    }
  }

  const matchedStudent = useMemo(() => {
    const c = cognome.trim().toLowerCase()
    const n = nome.trim().toLowerCase()
    if (!c) return null
    return (
      students.find((s) => s.cognome.trim().toLowerCase() === c && s.nome.trim().toLowerCase() === n) ??
      null
    )
  }, [students, cognome, nome])

  async function handleSave() {
    if (!appelloId || !courseId) {
      setSaveError('Seleziona corso e appello prima di salvare.')
      return
    }
    if (!cognome.trim() || !nome.trim()) {
      setSaveError('Cognome e nome sono obbligatori.')
      return
    }
    setSaving(true)
    setSaveError('')
    try {
      let studentId = matchedStudent?.id
      if (!studentId) {
        const { data, error } = await supabase
          .from('students')
          .insert({ course_id: courseId, cognome: cognome.trim(), nome: nome.trim() })
          .select()
          .single()
        if (error) throw error
        studentId = (data as Student).id
      }
      const { error } = await supabase.from('grades').upsert(
        {
          appello_id: appelloId,
          student_id: studentId,
          voto_scritto: voto === '' ? null : Number(voto),
          lode,
          scansionato: true,
        },
        { onConflict: 'appello_id,student_id' }
      )
      if (error) throw error
      setStep('done')
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Errore durante il salvataggio.')
    } finally {
      setSaving(false)
    }
  }

  function startOver() {
    setPhotoDataUrl(null)
    setQrFound(false)
    setCognome('')
    setNome('')
    setVoto('')
    setLode(false)
    setSaveError('')
    resetCrop()
    setStep('capture')
  }

  return (
    <div>
      <div className="breadcrumb">
        {course ? <Link to={`/corsi/${course.id}`}>&larr; {course.nome}</Link> : <Link to="/">&larr; Corsi</Link>}
      </div>
      <h2>Scansiona compito</h2>

      {step !== 'done' && (
        <div className="step-indicator">
          {STEPS.map((s, i) => (
            <div key={s} className={`step-dot ${i === stepIndex ? 'active' : i < stepIndex ? 'done' : ''}`} />
          ))}
        </div>
      )}

      {step === 'capture' && (
        <div className="camera-box">
          <p className="muted" style={{ textAlign: 'center' }}>
            Inquadra l'intero riquadro del template (QR, cognome/nome, voto) e scatta o carica una foto.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFile(file)
            }}
          />
          <button className="btn" onClick={() => fileInputRef.current?.click()}>
            Scatta / carica foto
          </button>
        </div>
      )}

      {step === 'identify' && photoDataUrl && (
        <div className="camera-box">
          <img src={photoDataUrl} alt="Compito scansionato" />
          {qrFound && course && appello ? (
            <p className="success">
              QR riconosciuto: {course.nome} — {appello.nome}
            </p>
          ) : (
            <div className="inline-form" style={{ width: '100%', maxWidth: 480 }}>
              <p className="muted">
                QR non rilevato. Seleziona manualmente corso e appello per questa scansione.
              </p>
              <div className="field">
                <label>Corso</label>
                <select value={courseId ?? ''} onChange={(e) => setCourseId(e.target.value || null)}>
                  <option value="">-- seleziona --</option>
                  {allCourses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome} ({c.anno_accademico})
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Appello</label>
                <select value={appelloId ?? ''} onChange={(e) => setAppelloId(e.target.value || null)}>
                  <option value="">-- seleziona --</option>
                  {courseAppelli.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
          <button
            className="btn"
            disabled={!courseId || !appelloId}
            onClick={() => setStep('crop-name')}
          >
            Continua
          </button>
        </div>
      )}

      {(step === 'crop-name' || step === 'crop-grade') && photoDataUrl && (
        <div className="camera-box">
          <p className="muted" style={{ textAlign: 'center' }}>
            {step === 'crop-name'
              ? 'Trascina e zooma per inquadrare solo il riquadro "COGNOME E NOME".'
              : 'Trascina e zooma per inquadrare solo il riquadro "VOTO".'}
          </p>
          <div style={{ position: 'relative', width: '100%', maxWidth: 480, height: 260, background: '#000' }}>
            <Cropper
              image={photoDataUrl}
              crop={crop}
              zoom={zoom}
              aspect={step === 'crop-name' ? 5.5 : 2.5}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_area, areaPixels) => setCroppedArea(areaPixels)}
            />
          </div>
          {ocrBusy && (
            <div className="ocr-progress">
              <div className="ocr-progress-bar" style={{ width: `${Math.round(ocrProgress * 100)}%` }} />
            </div>
          )}
          <button
            className="btn"
            disabled={!croppedArea || ocrBusy}
            onClick={step === 'crop-name' ? confirmNameCrop : confirmGradeCrop}
          >
            {ocrBusy ? 'Riconoscimento in corso...' : 'Conferma ritaglio'}
          </button>
        </div>
      )}

      {step === 'confirm' && (
        <div className="inline-form" style={{ maxWidth: 480 }}>
          <p className="muted">Verifica e correggi i dati letti automaticamente prima di salvare.</p>
          {matchedStudent && (
            <p className="success" style={{ margin: 0 }}>
              Corrisponde a studente già presente: {matchedStudent.cognome} {matchedStudent.nome}
            </p>
          )}
          <div className="field">
            <label>Cognome</label>
            <input value={cognome} onChange={(e) => setCognome(e.target.value)} />
          </div>
          <div className="field">
            <label>Nome</label>
            <input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
            <div className="field">
              <label>Voto scritto</label>
              <input inputMode="decimal" value={voto} onChange={(e) => setVoto(e.target.value)} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={lode} onChange={(e) => setLode(e.target.checked)} />
              Lode
            </label>
          </div>
          {saveError && <p className="error">{saveError}</p>}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn" disabled={saving} onClick={handleSave}>
              {saving ? 'Salvataggio...' : 'Salva voto'}
            </button>
            <button className="btn secondary" onClick={startOver}>
              Ricomincia
            </button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="empty-state">
          <p className="success">Voto salvato correttamente.</p>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '0.75rem' }}>
            <button className="btn" onClick={startOver}>
              Scansiona un altro compito
            </button>
            {course && <Link className="btn secondary" to={`/corsi/${course.id}`}>Vai al corso</Link>}
          </div>
        </div>
      )}
    </div>
  )
}
