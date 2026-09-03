import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { supabase } from '../lib/supabase'
import type { Appello, Course, ExamQrPayload } from '../types'

const NAME_BOXES = 26
const GRADE_BOXES = 2

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

export default function Template() {
  const { courseId, appelloId } = useParams<{ courseId: string; appelloId: string }>()
  const [course, setCourse] = useState<Course | null>(null)
  const [appello, setAppello] = useState<Appello | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [numCopies, setNumCopies] = useState(1)

  useEffect(() => {
    async function load() {
      if (!courseId || !appelloId) return
      const [{ data: c }, { data: a }] = await Promise.all([
        supabase.from('courses').select('*').eq('id', courseId).single(),
        supabase.from('appelli').select('*').eq('id', appelloId).single(),
      ])
      setCourse(c as Course)
      setAppello(a as Appello)
      const payload: ExamQrPayload = { app: 'gestore-esami', v: 1, courseId, appelloId }
      const url = await QRCode.toDataURL(JSON.stringify(payload), { margin: 1, width: 140 })
      setQrDataUrl(url)
    }
    load()
  }, [courseId, appelloId])

  if (!course || !appello) return <p className="muted">Caricamento...</p>

  return (
    <div>
      <div className="breadcrumb no-print">
        <Link to={`/corsi/${course.id}`}>&larr; {course.nome}</Link>
      </div>
      <div className="toolbar no-print">
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

          <hr style={{ margin: '1rem 0', borderColor: '#ccc' }} />

          <div style={{ fontSize: '0.8rem', marginBottom: 8 }}>SVOLGIMENTO</div>
          {Array.from({ length: 22 }).map((_, i) => (
            <div key={i} style={{ borderBottom: '1px solid #ddd', height: 26 }} />
          ))}
        </div>
      ))}
    </div>
  )
}
