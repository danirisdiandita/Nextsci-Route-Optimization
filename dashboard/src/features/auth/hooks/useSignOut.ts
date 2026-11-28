import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { signOut } from '@/features/auth/api'
import { queryKeys } from '@/lib/queryKeys'

export function useSignOut() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  return () => {
    signOut()
    queryClient.setQueryData(queryKeys.session, null)
    return navigate({ to: '/sign-in' })
  }
}
