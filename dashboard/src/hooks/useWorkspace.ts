import { useQuery } from '@tanstack/react-query'
import { getWorkspace } from '@/api/mock/workspace'
import { queryKeys } from '@/lib/queryKeys'

export function useWorkspace() {
  return useQuery({ queryKey: queryKeys.workspaceSummary, queryFn: getWorkspace })
}
