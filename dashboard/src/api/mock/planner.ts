import type {
  Depot,
  Driver,
  DriverId,
  LatLng,
  Order,
  OrderId,
  Pin,
  PlanChangeOp,
  PlanGoal,
  PlanImpact,
  Route,
  RouteColor,
  RouteStop,
  TimeWindow,
  Trip,
  UnassignedReason,
  Vehicle,
} from '../types.ts'
import { bearing, driveMinutes, roadKm } from './geo.ts'

// A deterministic stand-in for the backend solver. It sweeps orders around the depot into one sector per
// driver, splits each sector into trips by vehicle capacity, orders each trip by earliest possible service,
// then tries to fit every stop it dropped into another route. It is fast enough to run on every preview.

export type FleetEntry = { driver: Driver; vehicle: Vehicle; color: RouteColor }

export type SolveSettings = { goal: PlanGoal; allowReloads: boolean; strictWindows: boolean; serviceMinutes: number }

export type PlanProblem = {
  depot: Depot
  /** The drivers to plan, each with the vehicle they drive and their route color. */
  fleet: FleetEntry[]
  orders: Order[]
  settings: SolveSettings
  pins: Pin[]
}

/** A route before it is stored, so it has no id or plan yet. */
export type RouteDraft = Omit<Route, 'id' | 'planId'>
export type Unplaced = { orderId: OrderId; reason: UnassignedReason }
export type PlanResult = { routes: RouteDraft[]; unassigned: Unplaced[] }

type Ctx = { depot: Depot; orders: Map<OrderId, Order>; settings: SolveSettings }
type Simulated = { route: RouteDraft; dropped: Unplaced[] }

/** Where an order is on the map, or null when its address was not found. */
export const orderLocation = (order: Order): LatLng | null => (order.geocode.status === 'not_found' ? null : order.geocode.location)

export const routeOrderIds = (route: Pick<Route, 'trips'>): OrderId[][] => route.trips.map((t) => t.stops.map((s) => s.orderId))

const round1 = (n: number) => Math.round(n * 10) / 10

/**
 * Times a driver's trips in the given order. A stop that would break a strict window, overload the vehicle,
 * or keep the driver past the end of the shift is dropped with that reason. With `sequence`, each trip is
 * first reordered by earliest possible service from where the driver is when it starts.
 */
function simulate(ctx: Ctx, entry: FleetEntry, groups: OrderId[][], sequence: boolean): Simulated {
  const { depot, settings, orders } = ctx
  const { driver, vehicle } = entry
  const kind = vehicle.kind
  const dropped: Unplaced[] = []
  const start = Math.max(driver.shift.start, depot.hours.start)
  let t = start
  let km = 0
  if (driver.start.kind === 'home') {
    km += roadKm(driver.start.location, depot.location)
    t += driveMinutes(driver.start.location, depot.location, kind)
  }
  let breakTaken: TimeWindow | null = null
  const breakIfDue = () => {
    if (driver.break && !breakTaken && t >= driver.break.window.start) {
      breakTaken = { start: t, end: t + driver.break.minutes }
      t = breakTaken.end
    }
  }
  const trips: Trip[] = []
  for (const group of groups) {
    breakIfDue()
    const tripStart = t
    t += depot.loadMinutes
    const depart = t
    const ids = sequence ? sequenceTrip(ctx, entry, group, t) : group
    const stops: RouteStop[] = []
    let pos = depot.location
    let load = 0
    let tripKm = 0
    for (const orderId of ids) {
      const order = orders.get(orderId)
      const loc = order && orderLocation(order)
      if (!order || !loc) {
        dropped.push({ orderId, reason: 'no_location' })
        continue
      }
      if (load + order.quantity > vehicle.capacity) {
        dropped.push({ orderId, reason: 'over_capacity' })
        continue
      }
      const before: { t: number; breakTaken: TimeWindow | null } = { t, breakTaken }
      breakIfDue()
      const eta = t + driveMinutes(pos, loc, kind)
      const begin = order.window ? Math.max(eta, order.window.start) : eta
      const lateMinutes = order.window ? Math.max(0, begin - order.window.end) : 0
      const etd = begin + (order.serviceMinutes ?? settings.serviceMinutes)
      const reason: UnassignedReason | null =
        settings.strictWindows && lateMinutes > 0
          ? 'missed_window'
          : etd + driveMinutes(loc, depot.location, kind) > driver.shift.end
            ? 'past_shift'
            : null
      if (reason) {
        ;({ t, breakTaken } = before)
        dropped.push({ orderId, reason })
        continue
      }
      stops.push({ orderId, eta, start: begin, etd, lateMinutes, failure: null })
      tripKm += roadKm(pos, loc)
      pos = loc
      t = etd
      load += order.quantity
    }
    if (stops.length === 0) {
      t = tripStart
      continue
    }
    tripKm += roadKm(pos, depot.location)
    t += driveMinutes(pos, depot.location, kind)
    km += tripKm
    trips.push({ depart, return: t, load, stops })
  }
  return {
    route: {
      driverId: driver.id,
      vehicleId: vehicle.id,
      color: entry.color,
      trips,
      break: breakTaken,
      start,
      end: t,
      distanceKm: round1(km),
      durationMin: t - start,
    },
    dropped,
  }
}

/** Orders a trip by earliest possible service. A stop whose window closes within 45 minutes goes first. */
function sequenceTrip(ctx: Ctx, entry: FleetEntry, ids: OrderId[], departAt: number): OrderId[] {
  const remaining = ids.filter((id) => ctx.orders.has(id))
  const ordered: OrderId[] = []
  let t = departAt
  let pos = ctx.depot.location
  while (remaining.length) {
    let best = 0
    let bestScore = Infinity
    let bestEnd = t
    let bestPos = pos
    remaining.forEach((id, i) => {
      const order = ctx.orders.get(id)!
      const loc = orderLocation(order) ?? pos
      const eta = t + driveMinutes(pos, loc, entry.vehicle.kind)
      const begin = order.window ? Math.max(eta, order.window.start) : eta
      const slack = order.window ? order.window.end - begin : Infinity
      const score = slack < 45 ? slack - 10_000 : begin
      if (score < bestScore) {
        bestScore = score
        best = i
        bestEnd = begin + (order.serviceMinutes ?? ctx.settings.serviceMinutes)
        bestPos = loc
      }
    })
    ordered.push(remaining.splice(best, 1)[0])
    t = bestEnd
    pos = bestPos
  }
  return ordered
}

/** Splits a driver's orders into trips: earlier windows first, then around the depot, cut at vehicle capacity. */
function tripsFor(ctx: Ctx, entry: FleetEntry, ids: OrderId[]): OrderId[][] {
  const angle = (id: OrderId) => bearing(ctx.depot.location, orderLocation(ctx.orders.get(id)!)!)
  const windowHour = (id: OrderId) => Math.floor((ctx.orders.get(id)!.window?.end ?? 24 * 60) / 120)
  const sorted = [...ids].sort((a, b) => windowHour(a) - windowHour(b) || angle(a) - angle(b))
  if (!ctx.settings.allowReloads) return [sorted]
  const trips: OrderId[][] = []
  let current: OrderId[] = []
  let load = 0
  for (const id of sorted) {
    const q = ctx.orders.get(id)!.quantity
    if (current.length && load + q > entry.vehicle.capacity) {
      trips.push(current)
      current = []
      load = 0
    }
    current.push(id)
    load += q
  }
  if (current.length) trips.push(current)
  return trips
}

/** Shares the orders around the depot into one angular sector per driver, sized by each driver's weight. */
function sweep(ctx: Ctx, fleet: FleetEntry[], ids: OrderId[]): Map<DriverId, OrderId[]> {
  const shares = new Map<DriverId, OrderId[]>(fleet.map((e) => [e.driver.id, []]))
  if (!fleet.length || !ids.length) return shares
  const angle = (id: OrderId) => bearing(ctx.depot.location, orderLocation(ctx.orders.get(id)!)!)
  const sorted = [...ids].sort((a, b) => angle(a) - angle(b))
  // Start the sweep after the widest empty arc, so no cluster of orders is split between the first and last driver.
  let gapAt = 0
  let widest = -1
  sorted.forEach((id, i) => {
    const next = sorted[(i + 1) % sorted.length]
    const gap = (angle(next) - angle(id) + 2 * Math.PI) % (2 * Math.PI)
    if (gap > widest) {
      widest = gap
      gapAt = (i + 1) % sorted.length
    }
  })
  const rotated = [...sorted.slice(gapAt), ...sorted.slice(0, gapAt)]
  const shiftMinutes = (e: FleetEntry) => e.driver.shift.end - e.driver.shift.start
  // A share is measured in work, not boxes: far orders cost more driving, and every box costs part of a reload.
  const effort = (id: OrderId) => {
    const order = ctx.orders.get(id)!
    const drive = driveMinutes(ctx.depot.location, orderLocation(order)!, 'motorbike')
    return (order.serviceMinutes ?? ctx.settings.serviceMinutes) + (order.quantity * (2 * drive + ctx.depot.loadMinutes)) / 10
  }
  // Balancing gives each driver the same work per hour. Otherwise a bigger vehicle, which reloads less, takes more.
  const weight = (e: FleetEntry) => shiftMinutes(e) * (ctx.settings.goal === 'balance' ? 1 : Math.sqrt(e.vehicle.capacity / 10))
  const totalWeight = fleet.reduce((sum, e) => sum + weight(e), 0)
  const totalEffort = rotated.reduce((sum, id) => sum + effort(id), 0)
  let driver = 0
  let done = 0
  let target = (totalEffort * weight(fleet[0])) / totalWeight
  for (const id of rotated) {
    const work = effort(id)
    while (driver < fleet.length - 1 && done + work / 2 > target) {
      driver++
      target += (totalEffort * weight(fleet[driver])) / totalWeight
    }
    shares.get(fleet[driver].driver.id)!.push(id)
    done += work
  }
  return shares
}

type InsertOptions = { forced: boolean }

/**
 * The cheapest place to add an order to a route: any position in any trip, or a new trip when reloads are on.
 * Returns null when every place drops a stop, unless `forced`, which then accepts late stops.
 */
function bestInsertion(ctx: Ctx, entry: FleetEntry, groups: OrderId[][], orderId: OrderId, { forced }: InsertOptions): Simulated | null {
  const base = simulate(ctx, entry, groups, false)
  const options: OrderId[][][] = []
  groups.forEach((trip, ti) => {
    for (let pos = 0; pos <= trip.length; pos++) {
      options.push(groups.map((g, gi) => (gi === ti ? [...g.slice(0, pos), orderId, ...g.slice(pos)] : g)))
    }
  })
  // Trips are usually full, so a new trip between two others is often the only place that keeps a window.
  if (ctx.settings.allowReloads || groups.length === 0) {
    for (let at = 0; at <= groups.length; at++) options.push([...groups.slice(0, at), [orderId], ...groups.slice(at)])
  }
  const cost = (s: Simulated) => s.route.end - base.route.end + s.route.distanceKm - base.route.distanceKm
  let best: Simulated | null = null
  for (const option of options) {
    const s = simulate(ctx, entry, option, false)
    if (s.dropped.length > base.dropped.length) continue
    if (!best || cost(s) < cost(best)) best = s
  }
  if (best || !forced) return best
  const soft: Ctx = { ...ctx, settings: { ...ctx.settings, strictWindows: false } }
  for (const option of options) {
    const s = simulate(soft, entry, option, false)
    if (s.dropped.some((d) => d.orderId === orderId)) continue
    if (!best || cost(s) < cost(best)) best = s
  }
  return best
}

/** Tries to fit each dropped order into any route. Returns the orders that still fit nowhere. */
function repair(ctx: Ctx, fleet: FleetEntry[], routes: Map<DriverId, RouteDraft>, dropped: Unplaced[]): Unplaced[] {
  const left: Unplaced[] = []
  const byWindow = [...dropped].sort((a, b) => (ctx.orders.get(a.orderId)?.window?.end ?? 1440) - (ctx.orders.get(b.orderId)?.window?.end ?? 1440))
  for (const item of byWindow) {
    if (item.reason === 'no_location') {
      left.push(item)
      continue
    }
    let best: { s: Simulated; added: number } | null = null
    for (const entry of fleet) {
      const current = routes.get(entry.driver.id)
      const s = bestInsertion(ctx, entry, current ? routeOrderIds(current) : [], item.orderId, { forced: false })
      const added = s && s.route.durationMin - (current?.durationMin ?? 0)
      if (s && added !== null && (!best || added < best.added)) best = { s, added }
    }
    if (best) routes.set(best.s.route.driverId, best.s.route)
    else left.push(item)
  }
  return left
}

function solveWith(ctx: Ctx, fleet: FleetEntry[], pins: Pin[]): PlanResult {
  const unassigned: Unplaced[] = []
  const pinned = new Map(pins.filter((p) => fleet.some((e) => e.driver.id === p.driverId)).map((p) => [p.orderId, p.driverId]))
  const free: OrderId[] = []
  for (const order of ctx.orders.values()) {
    if (!orderLocation(order)) unassigned.push({ orderId: order.id, reason: 'no_location' })
    else if (!fleet.length) unassigned.push({ orderId: order.id, reason: 'no_driver' })
    else if (!pinned.has(order.id)) free.push(order.id)
  }
  const shares = sweep(ctx, fleet, free)
  for (const [orderId, driverId] of pinned) if (ctx.orders.has(orderId) && orderLocation(ctx.orders.get(orderId)!)) shares.get(driverId)?.push(orderId)
  const routes = new Map<DriverId, RouteDraft>()
  const dropped: Unplaced[] = []
  for (const entry of fleet) {
    const s = simulate(ctx, entry, tripsFor(ctx, entry, shares.get(entry.driver.id) ?? []), true)
    routes.set(entry.driver.id, s.route)
    dropped.push(...s.dropped)
  }
  unassigned.push(...repair(ctx, fleet, routes, dropped))
  return {
    routes: fleet.map((e) => routes.get(e.driver.id)!).filter((r) => r.trips.length > 0),
    unassigned,
  }
}

const contextOf = (problem: PlanProblem): Ctx => ({
  depot: problem.depot,
  orders: new Map(problem.orders.map((o) => [o.id, o])),
  settings: problem.settings,
})

/** Solves a plan from scratch. The same problem always gives the same routes. */
export function solve(problem: PlanProblem): PlanResult {
  const ctx = contextOf(problem)
  if (problem.settings.goal !== 'min_drivers') return solveWith(ctx, problem.fleet, problem.pins)
  // Fewest drivers: add drivers, biggest vehicles first, until every located order fits.
  const bySize = [...problem.fleet].sort((a, b) => b.vehicle.capacity - a.vehicle.capacity)
  for (let k = 1; k < bySize.length; k++) {
    const result = solveWith(ctx, bySize.slice(0, k), problem.pins)
    if (result.unassigned.every((u) => u.reason === 'no_location')) return orderByFleet(problem.fleet, result)
  }
  return orderByFleet(problem.fleet, solveWith(ctx, bySize, problem.pins))
}

const orderByFleet = (fleet: FleetEntry[], result: PlanResult): PlanResult => ({
  ...result,
  routes: fleet.flatMap((e) => result.routes.filter((r) => r.driverId === e.driver.id)),
})

/** Ops that change what the solver optimizes, so the whole plan is solved again. */
const resolvingOps = new Set<PlanChangeOp['kind']>(['set_goal', 'set_reloads', 'set_strict_windows', 'add_driver'])

/**
 * Applies a change to solved routes and returns the routes after it. Ops that change the goal, the rules, or
 * the drivers solve again with `problem`, which must already hold the changed settings and drivers. Ops that
 * move stops edit only the routes they touch and keep every other route as it was.
 */
export function applyOps(problem: PlanProblem, current: PlanResult, ops: PlanChangeOp[]): PlanResult {
  if (ops.some((op) => resolvingOps.has(op.kind))) return solve(problem)
  const ctx = contextOf(problem)
  const routes = new Map(current.routes.map((r) => [r.driverId, r]))
  let unassigned = [...current.unassigned]
  const entryOf = (driverId: DriverId) => problem.fleet.find((e) => e.driver.id === driverId)
  const groupsOf = (driverId: DriverId) => {
    const r = routes.get(driverId)
    return r ? routeOrderIds(r) : []
  }
  const take = (orderId: OrderId) => {
    unassigned = unassigned.filter((u) => u.orderId !== orderId)
    for (const [driverId, r] of routes) {
      const groups = routeOrderIds(r)
      if (!groups.flat().includes(orderId)) continue
      const entry = entryOf(driverId)
      const kept = groups.map((g) => g.filter((id) => id !== orderId)).filter((g) => g.length)
      if (entry) routes.set(driverId, simulate(ctx, entry, kept, false).route)
    }
  }
  const put = (orderId: OrderId, driverId: DriverId) => {
    const entry = entryOf(driverId)
    const s = entry && bestInsertion(ctx, entry, groupsOf(driverId), orderId, { forced: true })
    if (s) routes.set(driverId, s.route)
    else unassigned.push({ orderId, reason: entry ? 'past_shift' : 'no_driver' })
  }
  for (const op of ops) {
    switch (op.kind) {
      case 'move_stop':
      case 'assign_stop':
        take(op.orderId)
        put(op.orderId, op.toDriverId)
        break
      case 'pin_stop':
        if (!groupsOf(op.driverId).flat().includes(op.orderId)) {
          take(op.orderId)
          put(op.orderId, op.driverId)
        }
        break
      case 'unassign_stop':
        take(op.orderId)
        unassigned.push({ orderId: op.orderId, reason: 'no_driver' })
        break
      case 'remove_driver': {
        const orphans = groupsOf(op.driverId).flat()
        routes.delete(op.driverId)
        const remaining = problem.fleet.filter((e) => e.driver.id !== op.driverId)
        unassigned.push(...repair(ctx, remaining, routes, orphans.map((orderId) => ({ orderId, reason: 'no_driver' as const }))))
        break
      }
      case 'add_driver':
      case 'set_goal':
      case 'set_reloads':
      case 'set_strict_windows':
        break
      default:
        op satisfies never
    }
  }
  return { routes: problem.fleet.flatMap((e) => routes.get(e.driver.id) ?? []).filter((r) => r.trips.length > 0), unassigned }
}

const lateCount = (result: PlanResult) =>
  result.routes.reduce((n, r) => n + r.trips.reduce((m, t) => m + t.stops.filter((s) => s.lateMinutes > 0).length, 0), 0)

/** What changed between two solutions of the same plan, per driver and in total. */
export function impactOf(before: PlanResult, after: PlanResult): PlanImpact {
  const driverIds = [...new Set([...before.routes, ...after.routes].map((r) => r.driverId))]
  const drivers = driverIds
    .map((driverId) => {
      const b = before.routes.find((r) => r.driverId === driverId)
      const a = after.routes.find((r) => r.driverId === driverId)
      return {
        driverId,
        minutesDelta: (a?.durationMin ?? 0) - (b?.durationMin ?? 0),
        kmDelta: round1((a?.distanceKm ?? 0) - (b?.distanceKm ?? 0)),
        end: a?.end ?? null,
      }
    })
    .filter((d) => d.minutesDelta !== 0 || d.kmDelta !== 0 || d.end === null)
  const sum = (result: PlanResult, f: (r: RouteDraft) => number) => result.routes.reduce((n, r) => n + f(r), 0)
  const missed = (result: PlanResult) => result.unassigned.filter((u) => u.reason === 'missed_window').length
  return {
    drivers,
    minutesDelta: sum(after, (r) => r.durationMin) - sum(before, (r) => r.durationMin),
    kmDelta: round1(sum(after, (r) => r.distanceKm) - sum(before, (r) => r.distanceKm)),
    windowsHeld: lateCount(after) <= lateCount(before) && missed(after) <= missed(before),
    lateStops: lateCount(after),
    unassignedDelta: after.unassigned.length - before.unassigned.length,
  }
}
