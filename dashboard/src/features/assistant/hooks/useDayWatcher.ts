import { useEffect, useMemo } from 'react'
import type { Incident } from '@/api/types'
import { incidentMessageId, watchDay } from '@/features/assistant/api'
import { useAgentMessages } from '@/features/assistant/hooks/useAgentMessages'
import { useSimulatedMinute } from '@/hooks/useSimulatedMinute'
import { useWorkspaceMutation } from '@/hooks/useWorkspaceMutation'

/**
 * Lets the agent watch the live day: when the simulated clock passes an incident it has not reported yet,
 * the agent looks at the day. watchDay reports each incident once, so two watchers never post it twice.
 */
export function useDayWatcher(incidents: Incident[] | null) {
  const minute = useSimulatedMinute()
  const { data: messages } = useAgentMessages()
  const watch = useWorkspaceMutation(watchDay)
  const due = useMemo(() => {
    if (minute === null || !incidents || !messages) return 0
    return incidents.filter((i) => i.at <= minute && !messages.some((m) => m.id === incidentMessageId(i))).length
  }, [incidents, messages, minute])
  const { mutate, isPending } = watch
  useEffect(() => {
    if (due > 0 && !isPending && minute !== null) mutate(minute)
  }, [due, isPending, minute, mutate])
}
