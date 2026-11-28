import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { askAgent } from '@/features/assistant/api'
import { useAgentPanel } from '@/hooks/useAgentPanel'
import { useIsWide } from '@/hooks/useIsWide'
import { queryKeys } from '@/lib/queryKeys'

/**
 * Sends a message to the dispatch agent. On a wide screen the agent panel opens, so the reply shows beside
 * the page. When the agent asks to show a stop, the dashboard opens it.
 */
export function useAskAgent() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const panel = useAgentPanel()
  const wide = useIsWide()
  return useMutation({
    mutationKey: queryKeys.agentTurn,
    mutationFn: askAgent,
    onMutate: () => {
      if (wide) panel.setOpen(true)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.workspace }),
    onSuccess: (turn) => {
      if (turn.open?.kind === 'stop') void navigate({ to: '/stops/$orderId', params: { orderId: turn.open.orderId } })
    },
  })
}
