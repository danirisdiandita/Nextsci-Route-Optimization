import { AppShell } from '@/app/shell/AppShell'
import { SignInPage } from '@/features/auth/components/SignInPage'
import { useSession } from '@/features/auth/hooks/useSession'

export default function App() {
  const session = useSession()
  if (session.isPending) return <main className="min-h-screen" aria-busy="true" />
  return session.data ? <AppShell user={session.data.user} /> : <SignInPage />
}
