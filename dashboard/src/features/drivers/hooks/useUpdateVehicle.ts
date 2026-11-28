import type { VehicleId } from '@/api/types'
import { updateVehicle, type VehicleInput } from '@/features/drivers/api'
import { useWorkspaceMutation } from '@/hooks/useWorkspaceMutation'

export function useUpdateVehicle() {
  return useWorkspaceMutation(({ vehicleId, patch }: { vehicleId: VehicleId; patch: Partial<VehicleInput> }) => updateVehicle(vehicleId, patch))
}
