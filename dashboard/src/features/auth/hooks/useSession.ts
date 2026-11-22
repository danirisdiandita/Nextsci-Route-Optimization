import { useQuery } from '@tanstack/react-query'
import { restoreSession } from '@/features/auth/api'
import { queryKeys } from '@/lib/queryKeys'

/** The signed-in user and session, or null when nobody is signed in. */
export function useSession() {
  return useQuery({ queryKey: queryKeys.session, queryFn: restoreSession, staleTime: Infinity, retry: false })
}
