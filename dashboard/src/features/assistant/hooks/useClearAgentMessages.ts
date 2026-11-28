import { clearAgentMessages } from '@/features/assistant/api'
import { useWorkspaceMutation } from '@/hooks/useWorkspaceMutation'

export function useClearAgentMessages() {
  return useWorkspaceMutation(clearAgentMessages)
}
