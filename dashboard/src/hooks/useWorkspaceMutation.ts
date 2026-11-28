import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'

/**
 * A mutation that refreshes every workspace query when it succeeds. Each mutation hook wraps one API
 * function with it, so no screen has to know which other tables a write touched.
 */
export function useWorkspaceMutation<TVariables = void, TData = unknown>(mutationFn: (variables: TVariables) => Promise<TData>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.workspace }),
  })
}
