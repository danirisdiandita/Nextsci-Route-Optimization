import { useQuery } from '@tanstack/react-query'
import type { DepotId } from '@/api/types'
import { getDepot } from '@/features/depots/api'
import { queryKeys } from '@/lib/queryKeys'

export function useDepot(depotId: DepotId) {
  return useQuery({ queryKey: queryKeys.depot(depotId), queryFn: () => getDepot(depotId) })
}
