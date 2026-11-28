import { deleteDriver } from '@/features/drivers/api'
import { useWorkspaceMutation } from '@/hooks/useWorkspaceMutation'

/** Takes the driver id. Draft plans spread the driver's stops over the other drivers. */
export function useDeleteDriver() {
  return useWorkspaceMutation(deleteDriver)
}
