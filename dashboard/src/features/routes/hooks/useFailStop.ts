import type { OrderId, PlanId } from '@/api/types'
import { failStop } from '@/features/routes/api'
import { useWorkspaceMutation } from '@/hooks/useWorkspaceMutation'

/** Marks a stop on a live route as not delivered. */
export function useFailStop() {
  return useWorkspaceMutation(({ planId, orderId, reason }: { planId: PlanId; orderId: OrderId; reason: string }) => failStop(planId, orderId, reason))
}
