import { useQuery } from '@tanstack/react-query'
import { getPlan } from '@/api/mock/plan'
import type { PlanId } from '@/api/types'
import { queryKeys } from '@/lib/queryKeys'

export function usePlan(planId: PlanId) {
  return useQuery({ queryKey: queryKeys.plan(planId), queryFn: () => getPlan(planId) })
}
