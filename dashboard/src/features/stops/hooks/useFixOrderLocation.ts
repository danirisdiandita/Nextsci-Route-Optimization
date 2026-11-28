import type { OrderId } from '@/api/types'
import { fixOrderLocation, type LocationFix } from '@/features/stops/api'
import { useWorkspaceMutation } from '@/hooks/useWorkspaceMutation'

/** Confirms a candidate place for an address, or a pin dropped on the map. */
export function useFixOrderLocation() {
  return useWorkspaceMutation(({ orderId, fix }: { orderId: OrderId; fix: LocationFix }) => fixOrderLocation(orderId, fix))
}
