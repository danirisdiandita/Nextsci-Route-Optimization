import type {
  DriverId,
  Plan,
  PlanChangeOp,
  PlanId,
  PlanRules,
  PlanSettings,
  PlanView,
  Route,
  RouteColor,
  UnassignedOrder,
} from '../types.ts'
import { must, newId, type Db } from './db.ts'
import { applyOps, solve, type FleetEntry, type PlanProblem, type PlanResult } from './planner.ts'

// Plan rows and the solver meet here. Every module that solves or edits a plan's routes goes through these
// helpers, so routes, unassigned orders, and the plan version always change together.

const routeColor = (index: number) => ((index % 6) + 1) as RouteColor

/**
 * The drivers of a plan who can drive: each has a vehicle. Colors follow the order of `driverIds`, so a
 * driver keeps the same color while the plan changes.
 */
export function fleetOf(db: Db, driverIds: DriverId[]): FleetEntry[] {
  return driverIds.flatMap((driverId, i) => {
    const driver = db.driver.find((d) => d.id === driverId)
    const vehicle = driver?.vehicleId ? db.vehicle.find((v) => v.id === driver.vehicleId) : undefined
    return driver && vehicle ? [{ driver, vehicle, color: routeColor(i) }] : []
  })
}

export function problemOf(db: Db, settings: PlanSettings, rules: PlanRules): PlanProblem {
  return {
    depot: must(db.depot, settings.depotId, 'depot'),
    fleet: fleetOf(db, rules.driverIds),
    orders: db.order,
    settings: { goal: rules.goal, allowReloads: rules.allowReloads, strictWindows: rules.strictWindows, serviceMinutes: settings.serviceMinutes },
    pins: rules.pins,
  }
}

export const rulesOf = (plan: Plan): PlanRules => ({
  driverIds: plan.driverIds,
  goal: plan.goal,
  allowReloads: plan.allowReloads,
  strictWindows: plan.strictWindows,
  pins: plan.pins,
})

/** The plan's rules after a change: drivers added or removed, a new goal or rule, stops pinned. */
export function rulesAfter(rules: PlanRules, ops: PlanChangeOp[]): PlanRules {
  return ops.reduce<PlanRules>((r, op) => {
    switch (op.kind) {
      case 'set_goal':
        return { ...r, goal: op.goal }
      case 'set_reloads':
        return { ...r, allowReloads: op.allowReloads }
      case 'set_strict_windows':
        return { ...r, strictWindows: op.strictWindows }
      case 'add_driver':
        return r.driverIds.includes(op.driverId) ? r : { ...r, driverIds: [...r.driverIds, op.driverId] }
      case 'remove_driver':
        return { ...r, driverIds: r.driverIds.filter((id) => id !== op.driverId), pins: r.pins.filter((p) => p.driverId !== op.driverId) }
      case 'pin_stop':
        return { ...r, pins: [...r.pins.filter((p) => p.orderId !== op.orderId), { orderId: op.orderId, driverId: op.driverId }] }
      case 'move_stop':
      case 'assign_stop':
      case 'unassign_stop':
        return { ...r, pins: r.pins.filter((p) => p.orderId !== op.orderId) }
      default:
        return op satisfies never
    }
  }, rules)
}

export const planRows = (db: Db, planId: PlanId) => ({
  routes: db.route.filter((r) => r.planId === planId),
  unassigned: db.unassigned_order.filter((u) => u.planId === planId),
})

export function viewOf(db: Db, planId: PlanId): PlanView {
  return { plan: must(db.plan, planId, 'plan'), ...planRows(db, planId) }
}

/** The stored routes as the solver's result, so a change can start from them. */
export function resultOf(db: Db, planId: PlanId): PlanResult {
  const { routes, unassigned } = planRows(db, planId)
  return { routes, unassigned: unassigned.map(({ orderId, reason }) => ({ orderId, reason })) }
}

/** Gives solved routes their ids: a driver who already had a route in this plan keeps its id. */
export function routesFromResult(db: Db, planId: PlanId, result: PlanResult): { routes: Route[]; unassigned: UnassignedOrder[] } {
  const existing = db.route.filter((r) => r.planId === planId)
  return {
    routes: result.routes.map((draft) => ({
      ...draft,
      id: existing.find((r) => r.driverId === draft.driverId)?.id ?? newId('route'),
      planId,
    })),
    unassigned: result.unassigned.map((u) => ({ planId, ...u })),
  }
}

/** Replaces a plan's routes and unassigned orders. */
export function storeRoutes(db: Db, planId: PlanId, rows: { routes: Route[]; unassigned: UnassignedOrder[] }) {
  db.route = [...db.route.filter((r) => r.planId !== planId), ...rows.routes]
  db.unassigned_order = [...db.unassigned_order.filter((u) => u.planId !== planId), ...rows.unassigned]
}

export function solvePlan(db: Db, settings: PlanSettings, rules: PlanRules): PlanResult {
  return solve(problemOf(db, settings, rules))
}

/** Applies ops to a plan's stored routes without saving, for previews and changes. */
export function editPlan(db: Db, plan: Plan, ops: PlanChangeOp[]): { rules: PlanRules; before: PlanResult; after: PlanResult } {
  const rules = rulesAfter(rulesOf(plan), ops)
  const before = resultOf(db, plan.id)
  return { rules, before, after: applyOps(problemOf(db, plan, rules), before, ops) }
}

/** Deletes a plan and every row that belongs to it. */
export function removePlanRows(db: Db, planId: PlanId) {
  db.plan = db.plan.filter((p) => p.id !== planId)
  db.route = db.route.filter((r) => r.planId !== planId)
  db.unassigned_order = db.unassigned_order.filter((u) => u.planId !== planId)
  db.plan_change = db.plan_change.filter((c) => c.planId !== planId)
  db.dispatch = db.dispatch.filter((d) => d.planId !== planId)
  db.incident = db.incident.filter((i) => i.planId !== planId)
}

/** The plan the dashboard shows: the newest one. Null when nothing has been planned. */
export function currentPlan(db: Db): Plan | null {
  return db.plan.reduce<Plan | null>((newest, p) => (!newest || p.createdAt > newest.createdAt ? p : newest), null)
}
