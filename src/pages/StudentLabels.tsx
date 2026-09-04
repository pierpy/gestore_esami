import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { supabase } from '../lib/supabase'
import type { Course, Student, StudentQrPayload } from '../types'

interface LabelData {
  student: Student
  qrDataUrl: string
}

export default function StudentLabels() {
  const { courseId } = useParams<{ courseId: string }>()
  const [course, setCourse] = useState<Course | null>(null)
  const [labels, setLabels] = useState<LabelData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!courseId) return
      setLoading(true)
      const [{ data: c }, { data: studentsData }] = await Promise.all([
        supabase.from('courses').select('*').eq('id', courseId).single(),
        supabase
          .from('students')
          .select('*')
          .eq('course_id', courseId)
          .order('cognome', { ascending: true }),
      ])
      setCourse(c as Course)

      const students = (studentsData as Student[]) ?? []
      const generated = await Promise.all(
        students.map(async (student) => {
          const payload: StudentQrPayload = {
            app: 'gestore-esami',
            v: 2,
            kind: 'studente',
            courseId,
            studentId: student.id,
          }
          const qrDataUrl = await QRCode.toDataURL(JSON.stringify(payload), {
            margin: 1,
            width: 120,
          })
          return { student, qrDataUrl }
        })
      )
      setLabels(generated)
      setLoading(false)
    }
    load()
  }, [courseId])

  if (loading) return <p className="muted">Caricamento...</p>
  if (!course) return <p className="error">Corso non trovato.</p>

  return (
    <div>
      <div className="breadcrumb no-print">
        <Link to={`/corsi/${course.id}`}>&larr; {course.nome}</Link>
      </div>
      <div className="toolbar no-print">
        <button className="btn" onClick={() => window.print()}>
          Stampa etichette
        </button>
      </div>
      <p className="muted no-print">
        Un'etichetta per studente, valida per <strong>tutti gli appelli</strong> di questo corso:
        stampale una volta, ritagliale e falle incollare/graffettare dagli studenti sul proprio
        compito prima di consegnarlo. In fase di scansione, inquadrando l'etichetta l'app
        riconosce subito lo studente — non serve più scrivere né leggere il nome a mano.
      </p>

      {labels.length === 0 ? (
        <div className="empty-state">
          Nessuno studente in questo corso. Aggiungili dalla pagina del corso prima di generare le
          etichette.
        </div>
      ) : (
        <div
          style={{
            background: 'white',
            color: 'black',
            borderRadius: 8,
            padding: '1rem',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
            gap: '0.75rem',
          }}
        >
          {labels.map(({ student, qrDataUrl }) => (
            <div
              key={student.id}
              style={{
                border: '1px solid #ccc',
                borderRadius: 6,
                padding: '0.5rem',
                textAlign: 'center',
                breakInside: 'avoid',
              }}
            >
              <img src={qrDataUrl} alt={`QR ${student.cognome} ${student.nome}`} width={100} height={100} />
              <div style={{ fontSize: '0.8rem', fontWeight: 600, marginTop: 4 }}>
                {student.cognome} {student.nome}
              </div>
              {student.matricola && (
                <div style={{ fontSize: '0.7rem', color: '#666' }}>{student.matricola}</div>
              )}
              <div style={{ fontSize: '0.65rem', color: '#888' }}>{course.nome}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
