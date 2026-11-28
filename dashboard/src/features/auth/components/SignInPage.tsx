import type { FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ThemeToggle } from '@/components/ThemeToggle'
import { SignInBrand } from '@/features/auth/components/SignInBrand'
import { useSignIn } from '@/features/auth/hooks/useSignIn'

export function SignInPage() {
  const signIn = useSignIn()

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    signIn.mutate({ email: String(data.get('email')), password: String(data.get('password')) })
  }

  const submitting = signIn.isPending

  return (
    <main className="relative grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <title>Sign in · Nextsci</title>
      <ThemeToggle className="absolute top-4 right-4 z-10" />
      <section className="relative grid place-items-center overflow-hidden px-4 py-16 sm:px-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -top-[40%] h-[900px] bg-[radial-gradient(ellipse_40%_35%_at_50%_40%,var(--accent-soft),transparent_70%)] lg:hidden"
        />
        <div className="relative flex w-full max-w-[360px] flex-col items-center text-center lg:items-start lg:text-left">
          <img src="/favicon.svg" width={40} height={40} alt="" />
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
      </section>
      <SignInBrand />
    </main>
  )
}
