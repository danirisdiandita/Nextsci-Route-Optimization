import type { DepotId } from '@/api/types'
import { updateDepot, type DepotInput } from '@/features/depots/api'
import { useWorkspaceMutation } from '@/hooks/useWorkspaceMutation'

export function useUpdateDepot() {
  return useWorkspaceMutation(({ depotId, patch }: { depotId: DepotId; patch: Partial<DepotInput> }) => updateDepot(depotId, patch))
}
