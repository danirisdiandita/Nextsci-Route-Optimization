import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { searchAddresses } from '@/api/mock/depot'
import { queryKeys } from '@/lib/queryKeys'

/** Addresses that match what the dispatcher typed. Idle under three characters. */
export function useAddressSearch(text: string) {
  const query = text.trim()
  return useQuery({
    queryKey: queryKeys.addressSearch(query),
    queryFn: () => searchAddresses(query),
    enabled: query.length >= 3,
    placeholderData: keepPreviousData,
  })
}
