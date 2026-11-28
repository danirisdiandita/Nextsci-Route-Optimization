import { applyChange } from '@/api/mock/plan'
import { useWorkspaceMutation } from '@/hooks/useWorkspaceMutation'

/** Applies a proposed change to the current routes. Takes the change id. */
export function useApplyChange() {
  return useWorkspaceMutation(applyChange)
}
