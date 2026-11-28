import { useQuery } from '@tanstack/react-query'
import { getCurrentPlan } from '@/api/mock/plan'
import { queryKeys } from '@/lib/queryKeys'

export function useCurrentPlan() {
  return useQuery({ queryKey: queryKeys.currentPlan, queryFn: getCurrentPlan })
}
