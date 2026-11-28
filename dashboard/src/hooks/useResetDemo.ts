import { resetDemo } from '@/api/mock/workspace'
import { useWorkspaceMutation } from '@/hooks/useWorkspaceMutation'

/** Replaces everything with the sample workspace. */
export function useResetDemo() {
  return useWorkspaceMutation(resetDemo)
}
