import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

type Mode = 'signin' | 'signup'

export default function Login() {
  const { session } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'signup-done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  if (session) {
    // login riuscito (o sessione già presente): esci dalla pagina di login
    return <Navigate to="/" replace />
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setStatus('loading')
    setErrorMsg('')

    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) {
          setStatus('error')
          setErrorMsg(error.message)
        }
        // se ok, l'AuthProvider rileva la sessione e la app naviga da sola
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) {
          setStatus('error')
          setErrorMsg(error.message)
          return
        }
        if (data.session) {
          // conferma email disattivata sul progetto: sei già dentro
          return
        }
        setStatus('signup-done')
      }
    } catch (err) {
      setStatus('error')
      setErrorMsg(
        err instanceof Error
          ? `Errore di rete: ${err.message}. Controlla VITE_SUPABASE_URL nel file .env.`
          : 'Errore di rete sconosciuto.'
      )
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <h1>Gestore Esami</h1>
        <p className="muted">
          {mode === 'signin'
            ? 'Accedi con email e password per gestire corsi e voti.'
            : 'Crea il tuo account docente (serve solo la prima volta).'}
        </p>

        {status === 'signup-done' ? (
          <p className="success">
            Account creato. Se il progetto Supabase richiede la conferma email, apri il link che
            ti abbiamo inviato a <strong>{email}</strong>; altrimenti torna alla schermata di
            accesso e inserisci email e password.
          </p>
        ) : (
          <form onSubmit={handleSubmit}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              placeholder="nome.cognome@universita.it"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              placeholder={mode === 'signup' ? 'almeno 6 caratteri' : ''}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button type="submit" disabled={status === 'loading'}>
              {status === 'loading'
                ? 'Attendere...'
                : mode === 'signin'
                  ? 'Accedi'
                  : 'Crea account'}
            </button>
            {status === 'error' && <p className="error">{errorMsg}</p>}
          </form>
        )}

        <button
          className="link-btn"
          style={{ marginTop: '0.75rem' }}
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin')
            setStatus('idle')
            setErrorMsg('')
          }}
        >
          {mode === 'signin' ? 'Non hai un account? Creane uno' : 'Hai già un account? Accedi'}
        </button>
      </div>
    </div>
  )
}
