import { useQuery } from '@tanstack/react-query'
import { getSampleOrdersFile } from '@/api/mock/workspace'
import { queryKeys } from '@/lib/queryKeys'

/** The sample orders spreadsheet as text, for trying the import without a file. */
export function useSampleOrdersFile() {
  return useQuery({ queryKey: queryKeys.sampleOrdersFile, queryFn: getSampleOrdersFile, staleTime: Infinity })
}
