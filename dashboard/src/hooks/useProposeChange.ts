import { proposeChange } from '@/api/mock/plan'
import type { PlanChange, PlanId } from '@/api/types'
import { useWorkspaceMutation } from '@/hooks/useWorkspaceMutation'

/** Records a change for the dispatcher to apply or discard. */
export function useProposeChange() {
  return useWorkspaceMutation(({ planId, ...input }: { planId: PlanId } & Pick<PlanChange, 'authorKind' | 'summary' | 'diff'>) =>
    proposeChange(planId, input),
  )
}
