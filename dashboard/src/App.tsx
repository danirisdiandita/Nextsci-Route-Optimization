import { useEffect, useState, type FormEvent } from 'react'
import './app.css'
import { clearSession, loadSession, resume, saveSession, signIn, type Session, type User } from './auth'

type AuthState =
  | { kind: 'checking' }
  | { kind: 'signed-out' }
  | { kind: 'signed-in'; session: Session; user: User }

type FormState = { kind: 'idle' } | { kind: 'submitting' } | { kind: 'error'; message: string }

function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#f7f8f8" />
      <path
        d="M9 22.5h7.5a3.25 3.25 0 0 0 0-6.5h-1a3.25 3.25 0 0 1 0-6.5H23"
        fill="none"
        stroke="#08090a"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <circle cx="9" cy="22.5" r="2.6" fill="#08090a" />
      <circle cx="23" cy="9.5" r="2.6" fill="#5e9bff" />
    </svg>
  )
}

function SignIn({ onSignedIn }: { onSignedIn: (session: Session) => void }) {
  const [form, setForm] = useState<FormState>({ kind: 'idle' })

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    setForm({ kind: 'submitting' })
    const result = await signIn(String(data.get('email')), String(data.get('password')))
    if (result.ok) onSignedIn(result.session)
    else setForm({ kind: 'error', message: result.message })
  }

  const submitting = form.kind === 'submitting'

  return (
    <main className="auth">
      <div className="auth-glow" aria-hidden="true" />
      <div className="auth-panel">
        <Logo size={40} />
        <h1>Sign in to Nextsci</h1>
        <p className="auth-sub">Use the account your administrator created for you.</p>
        <form className="auth-form" onSubmit={submit}>
          <label>
            <span>Email</span>
            <input name="email" type="email" autoComplete="username" required autoFocus disabled={submitting} />
          </label>
          <label>
            <span>Password</span>
            <input name="password" type="password" autoComplete="current-password" required disabled={submitting} />
          </label>
          {form.kind === 'error' && (
            <p className="auth-error" role="alert">
              {form.message}
            </p>
          )}
          <button className="btn btn-primary" type="submit" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  )
}

function Home({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  return (
    <div className="home">
      <header className="topbar">
        <div className="brand">
          <Logo size={22} />
          Nextsci
        </div>
        <span className="topbar-user">{user.email}</span>
        <button className="btn btn-secondary" type="button" onClick={onSignOut}>
          Sign out
        </button>
      </header>
      <main className="empty">
        <h1>No routes yet</h1>
        <p>You are signed in. Route planning arrives with the next releases.</p>
      </main>
    </div>
  )
}

export default function App() {
  const [auth, setAuth] = useState<AuthState>(() => (loadSession() ? { kind: 'checking' } : { kind: 'signed-out' }))

  function apply(resumed: Awaited<ReturnType<typeof resume>>) {
    if (resumed) {
      saveSession(resumed.session)
      setAuth({ kind: 'signed-in', ...resumed })
    } else {
      clearSession()
      setAuth({ kind: 'signed-out' })
    }
  }

  async function enter(session: Session) {
    apply(await resume(session))
  }

  useEffect(() => {
    const stored = loadSession()
    if (!stored) return
    let live = true
    resume(stored).then((resumed) => live && apply(resumed))
    return () => {
      live = false
    }
  }, [])

  function signOut() {
    clearSession()
    setAuth({ kind: 'signed-out' })
  }

  switch (auth.kind) {
    case 'checking':
      return <main className="auth" aria-busy="true" />
    case 'signed-out':
      return <SignIn onSignedIn={enter} />
    case 'signed-in':
      return <Home user={auth.user} onSignOut={signOut} />
  }
}
