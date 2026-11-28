import type { DriverId } from '@/api/types'
import { updateDriver, type DriverInput } from '@/features/drivers/api'
import { useWorkspaceMutation } from '@/hooks/useWorkspaceMutation'

export function useUpdateDriver() {
  return useWorkspaceMutation(({ driverId, patch }: { driverId: DriverId; patch: Partial<DriverInput> }) => updateDriver(driverId, patch))
}
