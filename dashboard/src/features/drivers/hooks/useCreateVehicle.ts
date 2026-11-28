import { createVehicle } from '@/features/drivers/api'
import { useWorkspaceMutation } from '@/hooks/useWorkspaceMutation'

export function useCreateVehicle() {
  return useWorkspaceMutation(createVehicle)
}
