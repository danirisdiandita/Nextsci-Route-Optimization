import { createPlan } from '@/api/mock/plan'
import { useWorkspaceMutation } from '@/hooks/useWorkspaceMutation'

/** Solves a new draft plan from the chosen settings. */
export function useCreatePlan() {
  return useWorkspaceMutation(createPlan)
}
