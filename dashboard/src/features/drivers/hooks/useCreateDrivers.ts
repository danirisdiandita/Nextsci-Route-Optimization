import { createDrivers } from '@/features/drivers/api'
import { useWorkspaceMutation } from '@/hooks/useWorkspaceMutation'

/** Adds several drivers at once, such as from a spreadsheet. */
export function useCreateDrivers() {
  return useWorkspaceMutation(createDrivers)
}
