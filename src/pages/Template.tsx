import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { supabase } from '../lib/supabase'
import type { Appello, AppelloQrPayload, Course } from '../types'

const NAME_BOXES = 26
const GRADE_BOXES = 2
const OPTION_LETTERS = 'ABCDEFGH'

type PrintMode = 'completo' | 'fascia'

function BoxRow({ count }: { count: number }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 22,
            height: 28,
            border: '1.5px solid #000',
            borderRadius: 3,
          }}
        />
      ))}
    </div>
  )
}

function McqGrid({ numDomande, numOpzioni }: { numDomande: number; numOpzioni: number }) {
  const letters = OPTION_LETTERS.slice(0, numOpzioni).split('')
  return (
    <div>
      <div style={{ fontSize: '0.8rem', marginBottom: 6 }}>
        RISPOSTE A SCELTA MULTIPLA (annerisci la casella)
      </div>
      <div style={{ columnCount: numDomande > 14 ? 2 : 1, columnGap: 28 }}>
        {Array.from({ length: numDomande }).map((_, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              breakInside: 'avoid',
              marginBottom: 7,
            }}
          >
            <div style={{ width: 20, fontSize: '0.8rem' }}>{i + 1}.</div>
            {letters.map((l) => (
              <div key={l} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <div style={{ fontSize: '0.6rem' }}>{l}</div>
                <div style={{ width: 15, height: 15, border: '1.5px solid #000', borderRadius: 3 }} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function CutLine({ label }: { label: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        margin: '1rem 0',
        color: '#888',
        fontSize: '0.75rem',
      }}
    >
      <span>&#9986;</span>
      <div style={{ flex: 1, borderTop: '1px dashed #999' }} />
      <span>{label}</span>
      <div style={{ flex: 1, borderTop: '1px dashed #999' }} />
    </div>
  )
}

export default function Template() {
  const { courseId, appelloId } = useParams<{ courseId: string; appelloId: string }>()
  const [course, setCourse] = useState<Course | null>(null)
  const [appello, setAppello] = useState<Appello | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [numCopies, setNumCopies] = useState(1)
  const [printMode, setPrintMode] = useState<PrintMode>('completo')

  const [numDomande, setNumDomande] = useState(0)
  const [numOpzioni, setNumOpzioni] = useState(4)
  const [mcqSaving, setMcqSaving] = useState(false)
  const [mcqSaved, setMcqSaved] = useState(false)

  useEffect(() => {
    async function load() {
      if (!courseId || !appelloId) return
      const [{ data: c }, { data: a }] = await Promise.all([
        supabase.from('courses').select('*').eq('id', courseId).single(),
        supabase.from('appelli').select('*').eq('id', appelloId).single(),
      ])
      setCourse(c as Course)
      setAppello(a as Appello)
      const appelloData = a as Appello
      setNumDomande(appelloData?.mcq_num_domande ?? 0)
      setNumOpzioni(appelloData?.mcq_num_opzioni ?? 4)
      const payload: AppelloQrPayload = {
        app: 'gestore-esami',
        v: 2,
        kind: 'appello',
        courseId,
        appelloId,
      }
      const url = await QRCode.toDataURL(JSON.stringify(payload), { margin: 1, width: 140 })
      setQrDataUrl(url)
    }
    load()
  }, [courseId, appelloId])

  async function saveMcqConfig() {
    if (!appelloId) return
    setMcqSaving(true)
    setMcqSaved(false)
    const { error } = await supabase
      .from('appelli')
      .update({ mcq_num_domande: numDomande || null, mcq_num_opzioni: numOpzioni })
      .eq('id', appelloId)
    setMcqSaving(false)
    if (!error) setMcqSaved(true)
  }

  if (!course || !appello) return <p className="muted">Caricamento...</p>

  const hasMcq = numDomande > 0

  return (
    <div>
      <div className="breadcrumb no-print">
        <Link to={`/corsi/${course.id}`}>&larr; {course.nome}</Link>
      </div>

      <div className="inline-form no-print">
        <p className="muted" style={{ margin: 0 }}>
          Domande a risposta multipla per questo appello (lascia 0 se il compito non le prevede).
          Se le tue domande sono già su un tuo foglio stampato, usa la modalità{' '}
          <strong>"Solo fascia da allegare"</strong> qui sotto: stampi solo QR + nome + voto +
          griglia risposte su una fascia da ritagliare e graffettare al tuo foglio, senza dover
          rifare nulla.
        </p>
        <div className="inline-form row" style={{ background: 'none', border: 'none', padding: 0 }}>
          <div className="field">
            <label>Numero domande</label>
            <input
              type="number"
              min={0}
              max={60}
              value={numDomande}
              onChange={(e) => setNumDomande(Math.max(0, Number(e.target.value)))}
            />
          </div>
          <div className="field">
            <label>Opzioni per domanda</label>
            <input
              type="number"
              min={2}
              max={8}
              value={numOpzioni}
              onChange={(e) => setNumOpzioni(Math.min(8, Math.max(2, Number(e.target.value))))}
            />
          </div>
          <button className="btn secondary" onClick={saveMcqConfig} disabled={mcqSaving}>
            {mcqSaving ? 'Salvataggio...' : 'Salva configurazione'}
          </button>
          {mcqSaved && <span className="success">Salvata</span>}
        </div>
      </div>

      <p className="muted no-print" style={{ margin: '0.5rem 0' }}>
        Consiglio: se hai già stampato le{' '}
        <Link to={`/corsi/${course.id}/etichette`}>etichette QR personali degli studenti</Link>,
        usa quelle invece di far scrivere il nome a mano — sono riconosciute all'istante e non
        richiedono nessuna lettura OCR. Il riquadro Cognome/Nome qui sotto resta come ripiego per
        chi non ha ancora un'etichetta.
      </p>

      <div className="toolbar no-print">
        <label className="field" style={{ maxWidth: 200 }}>
          <span>Modalità di stampa</span>
          <select value={printMode} onChange={(e) => setPrintMode(e.target.value as PrintMode)}>
            <option value="completo">Foglio completo</option>
            <option value="fascia">Solo fascia da allegare</option>
          </select>
        </label>
        <label className="field" style={{ maxWidth: 160 }}>
          <span>Copie da stampare</span>
          <input
            type="number"
            min={1}
            max={50}
            value={numCopies}
            onChange={(e) => setNumCopies(Math.max(1, Number(e.target.value)))}
          />
        </label>
        <button className="btn" onClick={() => window.print()}>
          Stampa
        </button>
      </div>

      <p className="muted no-print">
        Ogni foglio riporta un QR univoco per <strong>{course.nome} — {appello.nome}</strong>: la
        fotocamera lo legge in fase di scansione per riconoscere automaticamente corso e appello.
        Chiedi agli studenti di scrivere <strong>una lettera per casella, in stampatello</strong> nel
        riquadro Cognome e Nome: aumenta molto l'affidabilità del riconoscimento automatico.
        {printMode === 'fascia' && (
          <>
            {' '}Ritaglia la fascia stampata lungo il bordo e graffettala in alto al tuo foglio con
            le domande, prima di consegnarla allo studente.
          </>
        )}
      </p>

      {Array.from({ length: numCopies }).map((_, copyIdx) => (
        <div
          key={copyIdx}
          style={{
            background: 'white',
            color: 'black',
            borderRadius: 8,
            padding: '1.5rem',
            marginBottom: '1.5rem',
            pageBreakAfter: 'always',
            border: printMode === 'fascia' ? '1.5px dashed #999' : 'none',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{course.nome}</div>
              <div style={{ fontSize: '0.9rem' }}>Anno accademico {course.anno_accademico}</div>
              <div style={{ fontSize: '0.9rem' }}>
                {appello.nome} — {new Date(appello.data).toLocaleDateString('it-IT')}
              </div>
            </div>
            {qrDataUrl && <img src={qrDataUrl} alt="QR compito" width={90} height={90} />}
          </div>

          <hr style={{ margin: '1rem 0', borderColor: '#ccc' }} />

          <div style={{ marginBottom: '0.75rem' }}>
            <div style={{ fontSize: '0.8rem', marginBottom: 4 }}>
              COGNOME E NOME (stampatello, una lettera per casella)
            </div>
            <BoxRow count={NAME_BOXES} />
          </div>

          <div style={{ display: 'flex', gap: '2rem', marginBottom: '0.5rem' }}>
            <div>
              <div style={{ fontSize: '0.8rem', marginBottom: 4 }}>MATRICOLA</div>
              <BoxRow count={8} />
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', marginBottom: 4 }}>
                VOTO (riservato al docente)
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <BoxRow count={GRADE_BOXES} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem' }}>
                  <div style={{ width: 20, height: 20, border: '1.5px solid #000', borderRadius: 3 }} />
                  LODE
                </div>
              </div>
            </div>
          </div>

          {hasMcq && (
            <>
              <hr style={{ margin: '1rem 0', borderColor: '#ccc' }} />
              <McqGrid numDomande={numDomande} numOpzioni={numOpzioni} />
            </>
          )}

          {printMode === 'fascia' ? (
            <>
              <CutLine label="ritaglia e graffetta al tuo foglio" />
              <p style={{ fontSize: '0.7rem', color: '#888', textAlign: 'center', margin: 0 }}>
                Questa fascia va allegata al foglio con le domande dell'esame: non contiene testo
                delle domande, solo i dati che la scansione legge automaticamente.
              </p>
            </>
          ) : (
            <>
              <CutLine label="da qui in poi è lo svolgimento (facoltativo staccare)" />
              <div style={{ fontSize: '0.8rem', marginBottom: 8 }}>SVOLGIMENTO</div>
              {Array.from({ length: 22 }).map((_, i) => (
                <div key={i} style={{ borderBottom: '1px solid #ddd', height: 26 }} />
              ))}
            </>
          )}
        </div>
      ))}
    </div>
  )
}
