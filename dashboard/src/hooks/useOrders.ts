import { useQuery } from '@tanstack/react-query'
import { listOrders } from '@/api/mock/order'
import { queryKeys } from '@/lib/queryKeys'

export function useOrders() {
  return useQuery({ queryKey: queryKeys.orders, queryFn: listOrders })
}
