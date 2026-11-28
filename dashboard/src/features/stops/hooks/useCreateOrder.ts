import { createOrder } from '@/features/stops/api'
import { useWorkspaceMutation } from '@/hooks/useWorkspaceMutation'

export function useCreateOrder() {
  return useWorkspaceMutation(createOrder)
}
