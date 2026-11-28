import { useQuery } from '@tanstack/react-query'
import { listAgentMessages } from '@/features/assistant/api'
import { queryKeys } from '@/lib/queryKeys'

/** The conversation with the dispatch agent and today's log, oldest first. */
export function useAgentMessages() {
  return useQuery({ queryKey: queryKeys.agentMessages, queryFn: listAgentMessages })
}
