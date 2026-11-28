import { addIncident } from '@/features/routes/api'
import { useWorkspaceMutation } from '@/hooks/useWorkspaceMutation'

/** Records something that delays a driver during the live day. */
export function useAddIncident() {
  return useWorkspaceMutation(addIncident)
}
