import { clearAll } from '@/api/mock/workspace'
import { useWorkspaceMutation } from '@/hooks/useWorkspaceMutation'

/** Deletes everything, so onboarding starts from an empty workspace. */
export function useClearWorkspace() {
  return useWorkspaceMutation(clearAll)
}
