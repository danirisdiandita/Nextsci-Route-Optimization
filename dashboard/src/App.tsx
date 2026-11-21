import type { FormEvent } from 'react'
import type { User } from '@/api/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useSession } from '@/hooks/useSession'
import { useSignIn } from '@/hooks/useSignIn'
import { useSignOut } from '@/hooks/useSignOut'

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
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-4 py-6">
      <ThemeToggle className="absolute top-4 right-4" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-[40%] h-[900px] bg-[radial-gradient(ellipse_40%_35%_at_50%_40%,var(--accent-soft),transparent_70%)]"
      />
      <div className="relative flex w-full max-w-[360px] flex-col items-center text-center">
        <Logo size={40} />
        <h1 className="mt-6 text-2xl font-semibold tracking-[-0.02em]">Sign in to Nextsci</h1>
        <p className="mt-2 text-sm text-muted-foreground">Use the account your administrator created for you.</p>
        <form className="mt-8 flex w-full flex-col gap-4 text-left" onSubmit={submit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email" className="text-[var(--text-2)]">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="username" required autoFocus disabled={submitting} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password" className="text-[var(--text-2)]">Password</Label>
            <Input id="password" name="password" type="password" autoComplete="current-password" required disabled={submitting} />
          </div>
          {signIn.isError && (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-[var(--danger-text)]"
            >
              {signIn.error.message}
            </p>
          )}
          <Button type="submit" size="lg" className="mt-2 h-10" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </main>
  )
}

function Home({ user }: { user: User }) {
  const signOut = useSignOut()
  return (
    <div>
      <header className="flex h-14 items-center gap-4 border-b px-5">
        <div className="brand mr-auto">
          <Logo size={22} />
          Nextsci
        </div>
        <span className="text-sm text-muted-foreground">{user.email}</span>
        <ThemeToggle />
        <Button variant="secondary" onClick={signOut}>
          Sign out
        </Button>
      </header>
      <main className="grid min-h-[calc(100vh-57px)] place-content-center gap-2 p-6 text-center">
        <h1 className="text-xl font-semibold tracking-[-0.012em]">No routes yet</h1>
        <p className="text-muted-foreground">You are signed in. Route planning arrives with the next releases.</p>
      </main>
    </div>
  )
}

export default function App() {
  const session = useSession()
  if (session.isPending) return <main className="min-h-screen" aria-busy="true" />
  return session.data ? <Home user={session.data.user} /> : <SignIn />
}
