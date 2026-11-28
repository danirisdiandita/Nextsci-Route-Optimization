import type { ColumnMapping, OrderImportId } from '@/api/types'
import { updateOrderImportMapping } from '@/features/stops/api'
import { useWorkspaceMutation } from '@/hooks/useWorkspaceMutation'

export function useUpdateOrderImportMapping() {
  return useWorkspaceMutation(({ importId, mapping }: { importId: OrderImportId; mapping: ColumnMapping }) => updateOrderImportMapping(importId, mapping))
}
