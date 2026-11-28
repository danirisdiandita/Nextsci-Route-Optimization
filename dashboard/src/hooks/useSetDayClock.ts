import { setDayClock } from '@/api/mock/liveDay'
import { useWorkspaceMutation } from '@/hooks/useWorkspaceMutation'

/** Runs, pauses, speeds up, or moves the simulated clock of the live day. */
export function useSetDayClock() {
  return useWorkspaceMutation(setDayClock)
}
