import { useQuery } from '@tanstack/react-query'
import { listDrivers } from '@/api/mock/driver'
import { queryKeys } from '@/lib/queryKeys'

export function useDrivers() {
  return useQuery({ queryKey: queryKeys.drivers, queryFn: listDrivers })
}
