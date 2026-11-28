import type { DriverId } from '@/api/types'
import { updateDrivers, type DriverInput } from '@/features/drivers/api'
import { useWorkspaceMutation } from '@/hooks/useWorkspaceMutation'

/** Applies the same change to several drivers, such as the shared shift and vehicle defaults. */
export function useUpdateDrivers() {
  return useWorkspaceMutation(({ driverIds, patch }: { driverIds: DriverId[]; patch: Partial<DriverInput> }) => updateDrivers(driverIds, patch))
}
