import { createAgentMessage } from '@/features/assistant/api'
import { useWorkspaceMutation } from '@/hooks/useWorkspaceMutation'

/** Adds a message to the conversation or a line to today's log. */
export function useCreateAgentMessage() {
  return useWorkspaceMutation(createAgentMessage)
}
