import type { PlanChangeOp, PlanId } from '@/api/types'
import { applyChange, proposeChange } from '@/features/routes/api'
import { useWorkspaceMutation } from '@/hooks/useWorkspaceMutation'

/** Records a change the dispatcher made by hand and applies it at once, so it shows in the history and can be undone. */
export function useSaveChange() {
  return useWorkspaceMutation(async ({ planId, summary, diff }: { planId: PlanId; summary: string; diff: PlanChangeOp[] }) => {
    const change = await proposeChange(planId, { authorKind: 'user', summary, diff })
    return applyChange(change.id)
  })
}
