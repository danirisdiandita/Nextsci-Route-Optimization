import { deleteOrders } from '@/features/stops/api'
import { useWorkspaceMutation } from '@/hooks/useWorkspaceMutation'

export function useDeleteOrders() {
  return useWorkspaceMutation(deleteOrders)
}
