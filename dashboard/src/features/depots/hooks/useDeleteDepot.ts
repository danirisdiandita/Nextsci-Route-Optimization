import { deleteDepot } from '@/features/depots/api'
import { useWorkspaceMutation } from '@/hooks/useWorkspaceMutation'

/** Takes the depot id. Fails with a readable message while vehicles belong to the depot. */
export function useDeleteDepot() {
  return useWorkspaceMutation(deleteDepot)
}
