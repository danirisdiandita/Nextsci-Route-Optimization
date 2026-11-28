import { useQuery } from '@tanstack/react-query'
import { getToday } from '@/features/assistant/api'
import { queryKeys } from '@/lib/queryKeys'

/** The stage of the dispatcher's day and what it needs, for the Today screen. */
export function useToday() {
  return useQuery({ queryKey: queryKeys.today, queryFn: getToday })
}
