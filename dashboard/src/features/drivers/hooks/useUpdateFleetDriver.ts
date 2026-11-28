import type { DriverId } from '@/api/types'
import { updateFleetDriver, type FleetDriverInput } from '@/features/drivers/api'
import { useWorkspaceMutation } from '@/hooks/useWorkspaceMutation'

/** Changes a driver and, when the patch names one, the vehicle they drive. */
export function useUpdateFleetDriver() {
  return useWorkspaceMutation(({ driverId, patch }: { driverId: DriverId; patch: Partial<FleetDriverInput> }) => updateFleetDriver(driverId, patch))
}
