import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setStatus('sending')
    setErrorMsg('')
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) {
      setStatus('error')
      setErrorMsg(error.message)
    } else {
      setStatus('sent')
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <h1>Gestore Esami</h1>
        <p className="muted">Accedi con la tua email universitaria per gestire corsi e voti.</p>
        {status === 'sent' ? (
          <p className="success">
            Ti abbiamo inviato un link di accesso a <strong>{email}</strong>. Apri l'email dallo
            stesso dispositivo per entrare.
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
            <button type="submit" disabled={status === 'sending'}>
              {status === 'sending' ? 'Invio in corso...' : 'Invia link di accesso'}
            </button>
            {status === 'error' && <p className="error">{errorMsg}</p>}
          </form>
        )}
      </div>
    </div>
  )
}
