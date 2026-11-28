import { createDriver } from '@/features/drivers/api'
import { useWorkspaceMutation } from '@/hooks/useWorkspaceMutation'

export function useCreateDriver() {
  return useWorkspaceMutation(createDriver)
}
