import { useIsMutating } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'

/** True while the agent answers a message, wherever the message came from. */
export function useAgentBusy() {
  return useIsMutating({ mutationKey: queryKeys.agentTurn }) > 0
}
