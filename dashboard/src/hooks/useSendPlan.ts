import { sendPlan, type SendOptions } from '@/api/mock/plan'
import type { PlanId } from '@/api/types'
import { useWorkspaceMutation } from '@/hooks/useWorkspaceMutation'

/** Sends every route of a plan. The result names drivers who could not be reached. */
export function useSendPlan() {
  return useWorkspaceMutation(({ planId, ...options }: { planId: PlanId } & SendOptions) => sendPlan(planId, options))
}
