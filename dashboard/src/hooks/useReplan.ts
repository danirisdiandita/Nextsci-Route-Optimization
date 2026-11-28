import { replan } from '@/api/mock/plan'
import type { PlanId, PlanSettings } from '@/api/types'
import { useWorkspaceMutation } from '@/hooks/useWorkspaceMutation'

/** Solves a plan again, with any settings changed. */
export function useReplan() {
  return useWorkspaceMutation(({ planId, patch }: { planId: PlanId; patch?: Partial<Omit<PlanSettings, 'day'>> }) => replan(planId, patch))
}
