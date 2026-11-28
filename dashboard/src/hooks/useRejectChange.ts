import { rejectChange } from '@/api/mock/plan'
import { useWorkspaceMutation } from '@/hooks/useWorkspaceMutation'

/** Discards a proposed change. Takes the change id. */
export function useRejectChange() {
  return useWorkspaceMutation(rejectChange)
}
