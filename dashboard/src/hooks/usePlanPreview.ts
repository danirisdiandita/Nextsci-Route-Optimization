import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { previewChange } from '@/api/mock/plan'
import type { PlanChangeOp, PlanId } from '@/api/types'
import { queryKeys } from '@/lib/queryKeys'

/** The routes and impact a change would give, without saving it. Idle while `diff` is empty. */
export function usePlanPreview(planId: PlanId | null, diff: PlanChangeOp[]) {
  return useQuery({
    queryKey: queryKeys.planPreview(planId ?? ('' as PlanId), diff),
    queryFn: () => previewChange(planId!, diff),
    enabled: planId !== null && diff.length > 0,
    placeholderData: keepPreviousData,
  })
}
