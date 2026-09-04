import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import type { Course } from '../types'

const AVATAR_GRADIENTS = [
  ['#7c6cf6', '#a855f7'],
  ['#38bdf8', '#6366f1'],
  ['#f472b6', '#a855f7'],
  ['#34d399', '#0ea5e9'],
  ['#fbbf24', '#f472b6'],
  ['#f87171', '#a855f7'],
]

function courseInitials(nome: string): string {
  const words = nome.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

function courseGradient(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  const [from, to] = AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length]
  return `linear-gradient(135deg, ${from}, ${to})`
}

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
          <div key={anno} style={{ marginBottom: '1.5rem' }}>
            <h3
              style={{
                display: 'inline-block',
                color: 'var(--muted)',
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                margin: '0 0 0.6rem',
                padding: '0.2rem 0.6rem',
                borderRadius: 999,
                background: 'var(--surface-2)',
                border: '1px solid var(--border-soft)',
              }}
            >
              {anno}
            </h3>
            <div className="card-list">
              {list.map((c) => (
                <Link key={c.id} to={`/corsi/${c.id}`} className="card-link">
                  <div className="card">
                    <div className="card-body">
                      <div className="course-avatar" style={{ background: courseGradient(c.id) }}>
                        {courseInitials(c.nome)}
                      </div>
                      <div>
                        <div className="card-title">{c.nome}</div>
                        <div className="card-sub">Anno accademico {c.anno_accademico}</div>
                      </div>
                    </div>
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
