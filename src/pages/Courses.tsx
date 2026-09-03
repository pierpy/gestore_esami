import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import type { Course } from '../types'

function currentAccademicYear() {
  const now = new Date()
  const y = now.getFullYear()
  // l'anno accademico italiano parte a settembre
  return now.getMonth() >= 8 ? `${y}/${y + 1}` : `${y - 1}/${y}`
}

export default function Courses() {
  const { session } = useAuth()
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [nome, setNome] = useState('')
  const [anno, setAnno] = useState(currentAccademicYear())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .order('anno_accademico', { ascending: false })
      .order('nome', { ascending: true })
    if (!error && data) setCourses(data as Course[])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!session) return
    setSaving(true)
    setError('')
    const { error } = await supabase
      .from('courses')
      .insert({ nome, anno_accademico: anno, user_id: session.user.id })
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    setNome('')
    setShowForm(false)
    load()
  }

  const grouped = courses.reduce<Record<string, Course[]>>((acc, c) => {
    ;(acc[c.anno_accademico] ??= []).push(c)
    return acc
  }, {})

  return (
    <div>
      <div className="page-title">
        <h2>I tuoi corsi</h2>
        <button className="btn" onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Annulla' : '+ Nuovo corso'}
        </button>
      </div>

      {showForm && (
        <form className="inline-form" onSubmit={handleCreate}>
          <div className="field">
            <label htmlFor="nome">Nome corso</label>
            <input
              id="nome"
              required
              placeholder="es. Analisi Matematica II"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="anno">Anno accademico</label>
            <input
              id="anno"
              required
              placeholder="2025/2026"
              value={anno}
              onChange={(e) => setAnno(e.target.value)}
            />
          </div>
          <button className="btn" type="submit" disabled={saving}>
            {saving ? 'Salvataggio...' : 'Crea corso'}
          </button>
          {error && <p className="error">{error}</p>}
        </form>
      )}

      {loading ? (
        <p className="muted">Caricamento...</p>
      ) : courses.length === 0 ? (
        <div className="empty-state">
          Nessun corso ancora. Crea il tuo primo corso per iniziare a registrare i voti.
        </div>
      ) : (
        Object.entries(grouped).map(([anno, list]) => (
          <div key={anno} style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: '0 0 0.5rem' }}>
              {anno}
            </h3>
            <div className="card-list">
              {list.map((c) => (
                <Link key={c.id} to={`/corsi/${c.id}`} className="card-link">
                  <div className="card">
                    <div className="card-title">{c.nome}</div>
                    <div className="card-sub">Anno accademico {c.anno_accademico}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
