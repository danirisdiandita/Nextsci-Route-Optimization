import { useQueryClient } from '@tanstack/react-query'
import { signOut } from '@/features/auth/api'
import { queryKeys } from '@/lib/queryKeys'

export function useSignOut() {
  const queryClient = useQueryClient()
  return () => {
    signOut()
    queryClient.setQueryData(queryKeys.session, null)
  }
}
