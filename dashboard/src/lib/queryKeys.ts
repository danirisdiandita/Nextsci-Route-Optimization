import type { DepotId, DriverId, OrderId, OrderImportId, PlanChangeOp, PlanId, VehicleId } from '@/api/types'

// Every TanStack Query key in the dashboard. Add a key here before you use it in a hook.
// Workspace data sits under the 'workspace' prefix. One write can change several tables (deleting a vehicle
// edits draft routes), so every mutation invalidates the whole prefix through useWorkspaceMutation.
export const queryKeys = {
  session: ['session'] as const,
  workspace: ['workspace'] as const,
  workspaceSummary: ['workspace', 'summary'] as const,
  depots: ['workspace', 'depot'] as const,
  depot: (depotId: DepotId) => ['workspace', 'depot', depotId] as const,
  vehicles: ['workspace', 'vehicle'] as const,
  vehicle: (vehicleId: VehicleId) => ['workspace', 'vehicle', vehicleId] as const,
  drivers: ['workspace', 'driver'] as const,
  driver: (driverId: DriverId) => ['workspace', 'driver', driverId] as const,
  orders: ['workspace', 'order'] as const,
  order: (orderId: OrderId) => ['workspace', 'order', orderId] as const,
  orderImports: ['workspace', 'order_import'] as const,
  orderImport: (importId: OrderImportId) => ['workspace', 'order_import', importId] as const,
  orderImportPreview: (importId: OrderImportId) => ['workspace', 'order_import', importId, 'preview'] as const,
  plans: ['workspace', 'plan'] as const,
  currentPlan: ['workspace', 'plan', 'current'] as const,
  plan: (planId: PlanId) => ['workspace', 'plan', planId] as const,
  planPreview: (planId: PlanId, diff: PlanChangeOp[]) => ['workspace', 'plan', planId, 'preview', diff] as const,
  planChanges: (planId: PlanId) => ['workspace', 'plan_change', planId] as const,
  dispatches: (planId: PlanId) => ['workspace', 'dispatch', planId] as const,
  incidents: (planId: PlanId) => ['workspace', 'incident', planId] as const,
  dayClock: ['workspace', 'day_clock'] as const,
  agentMessages: ['workspace', 'agent_message'] as const,
  addressSearch: (text: string) => ['address-search', text] as const,
  sampleOrdersFile: ['sample-orders-file'] as const,
}
