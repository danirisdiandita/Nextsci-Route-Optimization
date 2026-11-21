import { useQuery } from '@tanstack/react-query'
import { restoreSession } from '../api/auth'
import { queryKeys } from './queryKeys'

/** The signed-in user and session, or null when nobody is signed in. */
export function useSession() {
  return useQuery({ queryKey: queryKeys.session, queryFn: restoreSession, staleTime: Infinity, retry: false })
}
