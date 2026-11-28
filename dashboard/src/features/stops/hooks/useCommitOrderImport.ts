import type { OrderImportId } from '@/api/types'
import { commitOrderImport } from '@/features/stops/api'
import { useWorkspaceMutation } from '@/hooks/useWorkspaceMutation'

/** Turns the import's rows into stops and places their addresses on the map. */
export function useCommitOrderImport() {
  return useWorkspaceMutation(({ importId, rememberMapping }: { importId: OrderImportId; rememberMapping: boolean }) => commitOrderImport(importId, { rememberMapping }))
}
