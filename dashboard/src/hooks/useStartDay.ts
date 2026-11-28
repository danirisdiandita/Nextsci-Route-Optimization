import { startDay } from '@/api/mock/liveDay'
import { useWorkspaceMutation } from '@/hooks/useWorkspaceMutation'

/** Starts the live day for a sent plan. Takes the plan id. */
export function useStartDay() {
  return useWorkspaceMutation(startDay)
}
