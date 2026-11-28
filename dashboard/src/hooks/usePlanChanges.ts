import { useQuery } from '@tanstack/react-query'
import { listPlanChanges } from '@/api/mock/plan'
import type { PlanId } from '@/api/types'
import { queryKeys } from '@/lib/queryKeys'

/** Every change proposed for a plan, oldest first, with its status. */
export function usePlanChanges(planId: PlanId | null) {
  return useQuery({ queryKey: queryKeys.planChanges(planId!), queryFn: () => listPlanChanges(planId!), enabled: planId !== null })
}
