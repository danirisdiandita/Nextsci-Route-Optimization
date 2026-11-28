import { useQuery } from '@tanstack/react-query'
import type { DriverId } from '@/api/types'
import { getDriver } from '@/features/drivers/api'
import { queryKeys } from '@/lib/queryKeys'

export function useDriver(driverId: DriverId) {
  return useQuery({ queryKey: queryKeys.driver(driverId), queryFn: () => getDriver(driverId) })
}
