import { useQuery } from '@tanstack/react-query'
import { listVehicles } from '@/api/mock/vehicle'
import { queryKeys } from '@/lib/queryKeys'

export function useVehicles() {
  return useQuery({ queryKey: queryKeys.vehicles, queryFn: listVehicles })
}
