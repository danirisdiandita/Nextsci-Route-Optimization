import { deleteOrder } from '@/features/stops/api'
import { useWorkspaceMutation } from '@/hooks/useWorkspaceMutation'

export function useDeleteOrder() {
  return useWorkspaceMutation(deleteOrder)
}
