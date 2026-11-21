import { useQueryClient } from '@tanstack/react-query'
import { signOut } from '../api/auth'
import { queryKeys } from './queryKeys'

export function useSignOut() {
  const queryClient = useQueryClient()
  return () => {
    signOut()
    queryClient.setQueryData(queryKeys.session, null)
  }
}
