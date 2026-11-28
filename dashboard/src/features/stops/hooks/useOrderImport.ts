import { useQuery } from '@tanstack/react-query'
import type { OrderImportId } from '@/api/types'
import { getOrderImport } from '@/features/stops/api'
import { queryKeys } from '@/lib/queryKeys'

export function useOrderImport(importId: OrderImportId) {
  return useQuery({ queryKey: queryKeys.orderImport(importId), queryFn: () => getOrderImport(importId) })
}
