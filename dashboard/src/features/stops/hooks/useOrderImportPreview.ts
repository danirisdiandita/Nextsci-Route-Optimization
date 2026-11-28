import { useQuery } from '@tanstack/react-query'
import type { OrderImportId } from '@/api/types'
import { previewOrderImport } from '@/features/stops/api'
import { queryKeys } from '@/lib/queryKeys'

export function useOrderImportPreview(importId: OrderImportId) {
  return useQuery({ queryKey: queryKeys.orderImportPreview(importId), queryFn: () => previewOrderImport(importId) })
}
