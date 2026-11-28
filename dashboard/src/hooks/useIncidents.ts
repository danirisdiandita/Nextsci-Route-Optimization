import { useQuery } from '@tanstack/react-query'
import { listIncidents } from '@/api/mock/liveDay'
import type { PlanId } from '@/api/types'
import { queryKeys } from '@/lib/queryKeys'

/** What has delayed drivers during a plan's live day. */
export function useIncidents(planId: PlanId | null) {
  return useQuery({ queryKey: queryKeys.incidents(planId!), queryFn: () => listIncidents(planId!), enabled: planId !== null })
}
