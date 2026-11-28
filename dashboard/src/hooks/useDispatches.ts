import { useQuery } from '@tanstack/react-query'
import { listDispatches } from '@/api/mock/plan'
import type { PlanId } from '@/api/types'
import { queryKeys } from '@/lib/queryKeys'

/** The routes sent for a plan: one row per driver and send. */
export function useDispatches(planId: PlanId | null) {
  return useQuery({ queryKey: queryKeys.dispatches(planId!), queryFn: () => listDispatches(planId!), enabled: planId !== null })
}
