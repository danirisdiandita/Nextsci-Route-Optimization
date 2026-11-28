import type { DepotId, DriverId, OrderId, OrderImportId, Plan, PlanChangeOp, VehicleId } from '../types.ts'
import { must, type Db } from './db.ts'
import { editPlan, removePlanRows, routesFromResult, storeRoutes } from './planStore.ts'

// What a delete does to the rows that point at the deleted one, in one place. A plan that drivers already
// have (sent or live) blocks the delete. A draft plan is edited so it never points at a missing row.

const sentPlans = (db: Db) => db.plan.filter((p) => p.status !== 'draft')
const draftPlans = (db: Db) => db.plan.filter((p) => p.status === 'draft')

/** Applies ops to a draft plan and saves the result as a new version. */
function editDraft(db: Db, plan: Plan, ops: PlanChangeOp[]) {
  const { rules, after } = editPlan(db, plan, ops)
  storeRoutes(db, plan.id, routesFromResult(db, plan.id, after))
  Object.assign(plan, rules, { version: plan.version + 1 })
}

export function deleteDepotRow(db: Db, depotId: DepotId) {
  const depot = must(db.depot, depotId, 'depot')
  const vehicles = db.vehicle.filter((v) => v.depotId === depotId).length
  if (vehicles) throw new Error(`${depot.name} still has ${vehicles} vehicle${vehicles === 1 ? '' : 's'}. Move or delete them first.`)
  if (sentPlans(db).some((p) => p.depotId === depotId)) throw new Error(`Drivers already have routes from ${depot.name}.`)
  for (const plan of db.plan.filter((p) => p.depotId === depotId)) removePlanRows(db, plan.id)
  db.depot = db.depot.filter((d) => d.id !== depotId)
}

export function deleteDriverRow(db: Db, driverId: DriverId) {
  const driver = must(db.driver, driverId, 'driver')
  if (sentPlans(db).some((p) => p.driverIds.includes(driverId))) {
    throw new Error(`${driver.name} has a route that was already sent. Take them off that plan first.`)
  }
  for (const plan of draftPlans(db).filter((p) => p.driverIds.includes(driverId))) editDraft(db, plan, [{ kind: 'remove_driver', driverId }])
  db.dispatch = db.dispatch.filter((d) => d.driverId !== driverId)
  db.incident = db.incident.filter((i) => i.driverId !== driverId)
  db.driver = db.driver.filter((d) => d.id !== driverId)
}

export function deleteVehicleRow(db: Db, vehicleId: VehicleId) {
  const vehicle = must(db.vehicle, vehicleId, 'vehicle')
  const drivers = db.driver.filter((d) => d.vehicleId === vehicleId)
  if (sentPlans(db).some((p) => db.route.some((r) => r.planId === p.id && r.vehicleId === vehicleId))) {
    throw new Error(`${vehicle.name} is on a route that was already sent.`)
  }
  for (const plan of draftPlans(db)) {
    const ops = drivers.filter((d) => plan.driverIds.includes(d.id)).map((d): PlanChangeOp => ({ kind: 'remove_driver', driverId: d.id }))
    if (ops.length) editDraft(db, plan, ops)
  }
  for (const d of drivers) d.vehicleId = null
  db.vehicle = db.vehicle.filter((v) => v.id !== vehicleId)
}

export function deleteOrderRow(db: Db, orderId: OrderId) {
  const order = must(db.order, orderId, 'stop')
  if (sentPlans(db).some((p) => db.route.some((r) => r.planId === p.id && r.trips.some((t) => t.stops.some((s) => s.orderId === orderId))))) {
    throw new Error(`${order.customer} is on a route that was already sent.`)
  }
  for (const plan of draftPlans(db)) {
    const onRoute = db.route.some((r) => r.planId === plan.id && r.trips.some((t) => t.stops.some((s) => s.orderId === orderId)))
    if (onRoute) editDraft(db, plan, [{ kind: 'unassign_stop', orderId }])
    plan.pins = plan.pins.filter((p) => p.orderId !== orderId)
  }
  db.unassigned_order = db.unassigned_order.filter((u) => u.orderId !== orderId)
  db.order = db.order.filter((o) => o.id !== orderId)
}

export function deleteOrderImportRow(db: Db, importId: OrderImportId) {
  must(db.order_import, importId, 'import')
  for (const o of db.order) if (o.importId === importId) o.importId = null
  db.order_import = db.order_import.filter((i) => i.id !== importId)
}
