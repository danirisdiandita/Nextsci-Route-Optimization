import { updateDriver } from '@/features/assistant/api'
import type { DriverId } from '@/api/types'
import { useWorkspaceMutation } from '@/hooks/useWorkspaceMutation'

/** Adds a phone number to a driver, so their route can go out as a link. */
export function useSaveDriverPhone() {
  return useWorkspaceMutation(({ driverId, phone }: { driverId: DriverId; phone: string }) => updateDriver(driverId, { phone }))
}
