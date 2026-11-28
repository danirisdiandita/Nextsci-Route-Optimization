import { useQuery } from '@tanstack/react-query'
import { listDepots } from '@/api/mock/depot'
import { queryKeys } from '@/lib/queryKeys'

export function useDepots() {
  return useQuery({ queryKey: queryKeys.depots, queryFn: listDepots })
}
