import { createDepot } from '@/features/depots/api'
import { useWorkspaceMutation } from '@/hooks/useWorkspaceMutation'

export function useCreateDepot() {
  return useWorkspaceMutation(createDepot)
}
