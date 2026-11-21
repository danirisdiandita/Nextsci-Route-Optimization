import type { FormEvent } from 'react'
import './app.css'
import type { User } from './api/auth'
import { useSession } from './hooks/useSession'
import { useSignIn } from './hooks/useSignIn'
import { useSignOut } from './hooks/useSignOut'

function Logo({ size = 28 }: { size?: number }) {
  return <img src="/favicon.svg" width={size} height={size} alt="" />
}

function SignIn() {
  const signIn = useSignIn()

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    signIn.mutate({ email: String(data.get('email')), password: String(data.get('password')) })
  }

  const submitting = signIn.isPending

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
          {signIn.isError && (
            <p className="auth-error" role="alert">
              {signIn.error.message}
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

function Home({ user }: { user: User }) {
  const signOut = useSignOut()
  return (
    <div className="home">
      <header className="topbar">
        <div className="brand">
          <Logo size={22} />
          Nextsci
        </div>
        <span className="topbar-user">{user.email}</span>
        <button className="btn btn-secondary" type="button" onClick={signOut}>
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
  const session = useSession()
  if (session.isPending) return <main className="auth" aria-busy="true" />
  return session.data ? <Home user={session.data.user} /> : <SignIn />
}
