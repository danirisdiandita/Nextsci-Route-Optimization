import { undoChange } from '@/api/mock/plan'
import { useWorkspaceMutation } from '@/hooks/useWorkspaceMutation'

/** Puts back the routes from before the latest applied change. Takes the change id. */
export function useUndoChange() {
  return useWorkspaceMutation(undoChange)
}
