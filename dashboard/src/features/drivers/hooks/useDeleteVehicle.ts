import { deleteVehicle } from '@/features/drivers/api'
import { useWorkspaceMutation } from '@/hooks/useWorkspaceMutation'

/** Takes the vehicle id. Its drivers are left without a vehicle. */
export function useDeleteVehicle() {
  return useWorkspaceMutation(deleteVehicle)
}
