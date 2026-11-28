import type { DriverId } from '@/api/types'
import { applyDriverDefaults } from '@/features/drivers/api'
import { useWorkspaceMutation } from '@/hooks/useWorkspaceMutation'
import type { DriverDefaults } from '@/lib/driverDefaults'

/** Gives the drivers the default shift, break, and vehicle kind and capacity. */
export function useApplyDriverDefaults() {
  return useWorkspaceMutation(({ driverIds, defaults }: { driverIds: DriverId[]; defaults: DriverDefaults }) => applyDriverDefaults(driverIds, defaults))
}
