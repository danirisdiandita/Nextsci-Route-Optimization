import type { OrderId } from '@/api/types'
import { updateOrder, type OrderInput } from '@/features/stops/api'
import { useWorkspaceMutation } from '@/hooks/useWorkspaceMutation'

export function useUpdateOrder() {
  return useWorkspaceMutation(({ orderId, patch }: { orderId: OrderId; patch: Partial<OrderInput> }) => updateOrder(orderId, patch))
}
