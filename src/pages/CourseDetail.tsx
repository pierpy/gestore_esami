import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { parseEsse3Roster } from '../lib/importEsse3'
import { exportAppelloToExcel } from '../lib/exportExcel'
import { computeMedia } from '../lib/grades'
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

  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const importInputRef = useRef<HTMLInputElement>(null)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)

  const [exporting, setExporting] = useState(false)

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
    setSelectedIds(new Set())
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

  async function handleImportFile(file: File) {
    if (!courseId) return
    setImporting(true)
    setImportMsg('')
    setError('')
    try {
      const rows = await parseEsse3Roster(file)
      if (rows.length === 0) {
        setImportMsg('Nessuno studente trovato nel file.')
        return
      }

      const studentPayload = rows.map((r) => ({
        course_id: courseId,
        matricola: r.matricola,
        cognome: r.cognome,
        nome: r.nome,
      }))
      const { data: upserted, error: upsertError } = await supabase
        .from('students')
        .upsert(studentPayload, { onConflict: 'course_id,matricola' })
        .select()
      if (upsertError) throw upsertError
      const upsertedStudents = (upserted as Student[]) ?? []

      setStudents((prev) => {
        const map = new Map(prev.map((s) => [s.id, s]))
        upsertedStudents.forEach((s) => map.set(s.id, s))
        return Array.from(map.values()).sort((a, b) => a.cognome.localeCompare(b.cognome))
      })

      let importedGrades = 0
      if (activeAppelloId) {
        const idByMatricola = new Map(
          upsertedStudents.filter((s) => s.matricola).map((s) => [s.matricola as string, s.id])
        )
        const gradeRows = rows
          .filter((r) => r.voto && r.matricola && idByMatricola.has(r.matricola))
          .map((r) => ({
            appello_id: activeAppelloId,
            student_id: idByMatricola.get(r.matricola as string)!,
            voto_scritto: r.voto!.punteggio,
            lode: r.voto!.lode,
          }))
        if (gradeRows.length > 0) {
          const { data: upsertedGrades, error: gradeError } = await supabase
            .from('grades')
            .upsert(gradeRows, { onConflict: 'appello_id,student_id' })
            .select()
          if (gradeError) throw gradeError
          const newGrades = (upsertedGrades as Grade[]) ?? []
          importedGrades = newGrades.length
          setGrades((prev) => {
            const others = prev.filter((g) => !newGrades.some((n) => n.student_id === g.student_id))
            return [...others, ...newGrades]
          })
        }
      }

      setImportMsg(
        `${upsertedStudents.length} studenti importati/aggiornati` +
          (importedGrades > 0 ? `, ${importedGrades} voti importati dall'Esito` : '')
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore durante l'importazione del file.")
    } finally {
      setImporting(false)
    }
  }

  async function handleDeleteSelected() {
    if (selectedIds.size === 0) return
    const ids = Array.from(selectedIds)
    const label =
      ids.length === 1
        ? students.find((s) => s.id === ids[0])
          ? `${students.find((s) => s.id === ids[0])!.cognome} ${students.find((s) => s.id === ids[0])!.nome}`
          : 'questo studente'
        : `questi ${ids.length} studenti`
    const confirmed = window.confirm(
      `Eliminare definitivamente ${label}? Verranno cancellati anche tutti i voti registrati per ${
        ids.length === 1 ? 'lui/lei' : 'loro'
      } in questo corso. L'operazione non è reversibile.`
    )
    if (!confirmed) return

    setDeleting(true)
    setError('')
    try {
      const { error: deleteError } = await supabase.from('students').delete().in('id', ids)
      if (deleteError) throw deleteError
      setStudents((prev) => prev.filter((s) => !selectedIds.has(s.id)))
      setGrades((prev) => prev.filter((g) => !selectedIds.has(g.student_id)))
      setSelectedIds(new Set())
      setImportMsg('')
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore durante l'eliminazione.")
    } finally {
      setDeleting(false)
    }
  }

  function toggleSelect(studentId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(studentId)) next.delete(studentId)
      else next.add(studentId)
      return next
    })
  }

  function toggleSelectAll() {
    setSelectedIds((prev) =>
      prev.size === students.length ? new Set() : new Set(students.map((s) => s.id))
    )
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

  async function handleExport() {
    if (!course || !activeAppello) return
    setExporting(true)
    setError('')
    try {
      await exportAppelloToExcel(course, activeAppello, students, gradeByStudent)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore durante l'esportazione.")
    } finally {
      setExporting(false)
    }
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
            <input
              ref={importInputRef}
              type="file"
              accept=".xls,.xlsx"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleImportFile(file)
                e.target.value = ''
              }}
            />
            <button
              className="btn secondary"
              disabled={importing}
              onClick={() => importInputRef.current?.click()}
            >
              {importing ? 'Importazione...' : 'Importa da Esse3 (.xls)'}
            </button>
            <button
              className="btn secondary"
              disabled={exporting || students.length === 0}
              onClick={handleExport}
            >
              {exporting ? 'Esportazione...' : 'Esporta in Excel'}
            </button>
            {selectedIds.size > 0 && (
              <button className="btn danger" disabled={deleting} onClick={handleDeleteSelected}>
                {deleting
                  ? 'Eliminazione...'
                  : `Elimina selezionati (${selectedIds.size})`}
              </button>
            )}
          </div>

          <p className="muted" style={{ marginTop: '-0.5rem' }}>
            "Importa da Esse3" legge il file "Elenco Studenti Iscritti all'Appello" (.xls) e
            aggiunge/aggiorna gli studenti del corso; se la colonna Esito è già valorizzata,
            importa anche i voti nell'appello selezionato.
          </p>

          {importMsg && <p className="success">{importMsg}</p>}

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
                    <th>
                      <input
                        type="checkbox"
                        checked={students.length > 0 && selectedIds.size === students.length}
                        onChange={toggleSelectAll}
                        aria-label="Seleziona tutti"
                      />
                    </th>
                    <th>Studente</th>
                    <th>Matricola</th>
                    <th>Scritto</th>
                    <th>Lode</th>
                    <th>Orale</th>
                    <th>Media</th>
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
                        selected={selectedIds.has(s.id)}
                        onToggleSelect={() => toggleSelect(s.id)}
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
  selected,
  onToggleSelect,
  onSave,
}: {
  student: Student
  grade: Grade | undefined
  saving: boolean
  selected: boolean
  onToggleSelect: () => void
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

  const media = computeMedia(scritto === '' ? null : Number(scritto), orale === '' ? null : Number(orale))

  return (
    <tr>
      <td>
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          aria-label={`Seleziona ${student.cognome} ${student.nome}`}
        />
      </td>
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
      <td className="muted" style={{ fontWeight: 600, color: media != null ? 'var(--text)' : undefined }}>
        {media ?? '—'}
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
