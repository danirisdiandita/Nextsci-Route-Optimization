import { deletePlan } from '@/features/routes/api'
import { useWorkspaceMutation } from '@/hooks/useWorkspaceMutation'

export function useDeletePlan() {
  return useWorkspaceMutation(deletePlan)
}
