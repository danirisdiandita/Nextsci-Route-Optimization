import { useQuery } from '@tanstack/react-query'
import type { OrderId } from '@/api/types'
import { getOrder } from '@/features/stops/api'
import { queryKeys } from '@/lib/queryKeys'

export function useOrder(orderId: OrderId) {
  return useQuery({ queryKey: queryKeys.order(orderId), queryFn: () => getOrder(orderId) })
}
