import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Appello, Course, Grade, Student } from '../types'

export default function CourseDetail() {
  const { courseId } = useParams<{ courseId: string }>()
  const navigate = useNavigate()

  const [course, setCourse] = useState<Course | null>(null)
  const [appelli, setAppelli] = useState<Appello[]>([])
  const [activeAppelloId, setActiveAppelloId] = useState<string | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [grades, setGrades] = useState<Grade[]>([])
  const [loading, setLoading] = useState(true)

  const [showAppelloForm, setShowAppelloForm] = useState(false)
  const [appelloNome, setAppelloNome] = useState('')
  const [appelloData, setAppelloData] = useState(() => new Date().toISOString().slice(0, 10))

  const [showStudentForm, setShowStudentForm] = useState(false)
  const [matricola, setMatricola] = useState('')
  const [cognome, setCognome] = useState('')
  const [nome, setNome] = useState('')

  const [savingRow, setSavingRow] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function loadAll() {
    if (!courseId) return
    setLoading(true)
    const [{ data: courseData }, { data: appelliData }, { data: studentsData }] =
      await Promise.all([
        supabase.from('courses').select('*').eq('id', courseId).single(),
        supabase
          .from('appelli')
          .select('*')
          .eq('course_id', courseId)
          .order('data', { ascending: false }),
        supabase
          .from('students')
          .select('*')
          .eq('course_id', courseId)
          .order('cognome', { ascending: true }),
      ])
    setCourse(courseData as Course)
    setAppelli((appelliData as Appello[]) ?? [])
    setStudents((studentsData as Student[]) ?? [])
    if (appelliData && appelliData.length > 0) {
      setActiveAppelloId((prev) => prev ?? appelliData[0].id)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId])

  useEffect(() => {
    async function loadGrades() {
      if (!activeAppelloId) {
        setGrades([])
        return
      }
      const { data } = await supabase.from('grades').select('*').eq('appello_id', activeAppelloId)
      setGrades((data as Grade[]) ?? [])
    }
    loadGrades()
  }, [activeAppelloId])

  const gradeByStudent = useMemo(() => {
    const map = new Map<string, Grade>()
    grades.forEach((g) => map.set(g.student_id, g))
    return map
  }, [grades])

  async function handleCreateAppello(e: FormEvent) {
    e.preventDefault()
    if (!courseId) return
    setError('')
    const { data, error } = await supabase
      .from('appelli')
      .insert({ course_id: courseId, nome: appelloNome, data: appelloData })
      .select()
      .single()
    if (error) {
      setError(error.message)
      return
    }
    setAppelloNome('')
    setShowAppelloForm(false)
    setAppelli((prev) => [data as Appello, ...prev])
    setActiveAppelloId((data as Appello).id)
  }

  async function handleCreateStudent(e: FormEvent) {
    e.preventDefault()
    if (!courseId) return
    setError('')
    const { data, error } = await supabase
      .from('students')
      .insert({ course_id: courseId, matricola: matricola || null, cognome, nome })
      .select()
      .single()
    if (error) {
      setError(error.message)
      return
    }
    setMatricola('')
    setCognome('')
    setNome('')
    setShowStudentForm(false)
    setStudents((prev) => [...prev, data as Student].sort((a, b) => a.cognome.localeCompare(b.cognome)))
  }

  async function saveGrade(
    studentId: string,
    patch: Partial<Pick<Grade, 'voto_scritto' | 'lode' | 'voto_orale'>>
  ) {
    if (!activeAppelloId) return
    setSavingRow(studentId)
    setError('')
    const existing = gradeByStudent.get(studentId)
    const payload = {
      appello_id: activeAppelloId,
      student_id: studentId,
      voto_scritto: existing?.voto_scritto ?? null,
      lode: existing?.lode ?? false,
      voto_orale: existing?.voto_orale ?? null,
      ...patch,
    }
    const { data, error } = await supabase
      .from('grades')
      .upsert(payload, { onConflict: 'appello_id,student_id' })
      .select()
      .single()
    setSavingRow(null)
    if (error) {
      setError(error.message)
      return
    }
    setGrades((prev) => {
      const others = prev.filter((g) => g.student_id !== studentId)
      return [...others, data as Grade]
    })
  }

  if (loading) return <p className="muted">Caricamento...</p>
  if (!course) return <p className="error">Corso non trovato.</p>

  const activeAppello = appelli.find((a) => a.id === activeAppelloId) ?? null

  return (
    <div>
      <div className="breadcrumb">
        <Link to="/">&larr; I miei corsi</Link>
      </div>
      <div className="page-title">
        <h2>{course.nome}</h2>
        <span className="muted">{course.anno_accademico}</span>
      </div>

      <div className="tabs" style={{ overflowX: 'auto' }}>
        {appelli.map((a) => (
          <button
            key={a.id}
            className={`tab ${a.id === activeAppelloId ? 'active' : ''}`}
            onClick={() => setActiveAppelloId(a.id)}
          >
            {a.nome}
          </button>
        ))}
        <button className="tab" onClick={() => setShowAppelloForm((s) => !s)}>
          + Appello
        </button>
      </div>

      {showAppelloForm && (
        <form className="inline-form row" onSubmit={handleCreateAppello}>
          <div className="field">
            <label htmlFor="appelloNome">Nome appello</label>
            <input
              id="appelloNome"
              required
              placeholder="es. Gennaio 2026"
              value={appelloNome}
              onChange={(e) => setAppelloNome(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="appelloData">Data</label>
            <input
              id="appelloData"
              type="date"
              required
              value={appelloData}
              onChange={(e) => setAppelloData(e.target.value)}
            />
          </div>
          <button className="btn" type="submit">
            Crea
          </button>
        </form>
      )}

      {!activeAppello ? (
        <div className="empty-state">Crea un appello per iniziare a registrare i voti.</div>
      ) : (
        <>
          <div className="toolbar">
            <Link
              className="btn secondary"
              to={`/corsi/${course.id}/appelli/${activeAppello.id}/template`}
            >
              Stampa template compiti
            </Link>
            <Link className="btn secondary" to={`/corsi/${course.id}/etichette`}>
              Etichette QR studenti
            </Link>
            <button
              className="btn"
              onClick={() =>
                navigate(`/scansiona?courseId=${course.id}&appelloId=${activeAppello.id}`)
              }
            >
              Scansiona compito
            </button>
            <button className="btn secondary" onClick={() => setShowStudentForm((s) => !s)}>
              {showStudentForm ? 'Annulla' : '+ Studente'}
            </button>
          </div>

          {showStudentForm && (
            <form className="inline-form row" onSubmit={handleCreateStudent}>
              <div className="field">
                <label htmlFor="cognome">Cognome</label>
                <input id="cognome" required value={cognome} onChange={(e) => setCognome(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="nomeStud">Nome</label>
                <input id="nomeStud" required value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="matricola">Matricola (opz.)</label>
                <input id="matricola" value={matricola} onChange={(e) => setMatricola(e.target.value)} />
              </div>
              <button className="btn" type="submit">
                Aggiungi
              </button>
            </form>
          )}

          {error && <p className="error">{error}</p>}

          {students.length === 0 ? (
            <div className="empty-state">
              Nessuno studente in questo corso. Aggiungilo manualmente o scansiona un compito.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="grades">
                <thead>
                  <tr>
                    <th>Studente</th>
                    <th>Matricola</th>
                    <th>Scritto</th>
                    <th>Lode</th>
                    <th>Orale</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => {
                    const g = gradeByStudent.get(s.id)
                    return (
                      <GradeRow
                        key={s.id}
                        student={s}
                        grade={g}
                        saving={savingRow === s.id}
                        onSave={(patch) => saveGrade(s.id, patch)}
                      />
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function GradeRow({
  student,
  grade,
  saving,
  onSave,
}: {
  student: Student
  grade: Grade | undefined
  saving: boolean
  onSave: (patch: Partial<Pick<Grade, 'voto_scritto' | 'lode' | 'voto_orale'>>) => void
}) {
  const [scritto, setScritto] = useState(grade?.voto_scritto?.toString() ?? '')
  const [lode, setLode] = useState(grade?.lode ?? false)
  const [orale, setOrale] = useState(grade?.voto_orale?.toString() ?? '')

  useEffect(() => {
    setScritto(grade?.voto_scritto?.toString() ?? '')
    setLode(grade?.lode ?? false)
    setOrale(grade?.voto_orale?.toString() ?? '')
  }, [grade])

  const dirty =
    scritto !== (grade?.voto_scritto?.toString() ?? '') ||
    lode !== (grade?.lode ?? false) ||
    orale !== (grade?.voto_orale?.toString() ?? '')

  return (
    <tr>
      <td>
        {student.cognome} {student.nome}
        {grade?.scansionato && <span className="grade-pill ok" style={{ marginLeft: 6 }}>scansionato</span>}
      </td>
      <td className="muted">{student.matricola ?? '—'}</td>
      <td>
        <input
          inputMode="decimal"
          value={scritto}
          onChange={(e) => setScritto(e.target.value)}
          placeholder="—"
        />
      </td>
      <td>
        <input type="checkbox" checked={lode} onChange={(e) => setLode(e.target.checked)} />
      </td>
      <td>
        <input
          inputMode="decimal"
          value={orale}
          onChange={(e) => setOrale(e.target.value)}
          placeholder="—"
        />
      </td>
      <td>
        <button
          className="btn small"
          disabled={!dirty || saving}
          onClick={() =>
            onSave({
              voto_scritto: scritto === '' ? null : Number(scritto),
              lode,
              voto_orale: orale === '' ? null : Number(orale),
            })
          }
        >
          {saving ? '...' : 'Salva'}
        </button>
      </td>
    </tr>
  )
}
