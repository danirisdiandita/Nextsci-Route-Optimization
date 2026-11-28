import { useQuery } from '@tanstack/react-query'
import { getDayClock } from '@/api/mock/liveDay'
import { queryKeys } from '@/lib/queryKeys'

export function useDayClock() {
  return useQuery({ queryKey: queryKeys.dayClock, queryFn: getDayClock })
}
