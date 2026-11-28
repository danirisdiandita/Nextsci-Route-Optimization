import { createFleetDrivers } from '@/features/drivers/api'
import { useWorkspaceMutation } from '@/hooks/useWorkspaceMutation'

/** Adds one or more drivers with their vehicles. Nothing is saved if any row is invalid. */
export function useCreateFleetDrivers() {
  return useWorkspaceMutation(createFleetDrivers)
}
