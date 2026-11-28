// What the routes screens compute from a plan: the settings summary, timeline blocks, where a dragged stop
// lands, how a change reads, and who is late during the live day. Plain functions, so tests can run them.
import type { StopProgress } from '../../api/mock/clock.ts'
import type {
  Driver,
  DriverId,
  LatLng,
  Minute,
  Order,
  OrderId,
  PlanGoal,
  PlanImpact,
  Route,
  StopPosition,
  TimeWindow,
  UnassignedReason,
  Vehicle,
} from '../../api/types.ts'
import { formatMinutesDelta } from '../../lib/time.ts'

export const goalCopy: Record<PlanGoal, { title: string; hint: string }> = {
  min_time: { title: 'Least total driving time', hint: 'Cheapest overall. Some drivers may finish much earlier than others.' },
  balance: { title: 'Balance work between drivers', hint: 'Everyone finishes around the same time.' },
  min_drivers: { title: 'Use as few drivers as possible', hint: 'Leaves spare drivers free for the day.' },
}

export const unassignedCopy: Record<UnassignedReason, string> = {
  no_location: 'Address not found',
  missed_window: 'No driver reaches it inside its time window',
  over_capacity: 'Too big for the vehicles',
  past_shift: 'No driver has time left',
  no_driver: 'Not given to a driver',
}

export type PlanSummary = {
  stops: number
  located: number
  /** Chosen drivers who have a vehicle. */
  drivers: number
  load: number
  /** Boxes the chosen vehicles carry on one trip together. */
  capacity: number
  hours: TimeWindow | null
}

/** The numbers beside the plan settings, for the drivers the dispatcher picked. */
export function planSummary(orders: Order[], drivers: Driver[], vehicles: Vehicle[], driverIds: readonly DriverId[]): PlanSummary {
  const chosen = drivers.filter((d) => driverIds.includes(d.id) && d.vehicleId)
  const capacity = chosen.reduce((n, d) => n + (vehicles.find((v) => v.id === d.vehicleId)?.capacity ?? 0), 0)
  return {
    stops: orders.length,
    located: orders.filter((o) => o.geocode.status !== 'not_found').length,
    drivers: chosen.length,
    load: orders.reduce((n, o) => n + o.quantity, 0),
    capacity,
    hours: chosen.length
      ? { start: Math.min(...chosen.map((d) => d.shift.start)), end: Math.max(...chosen.map((d) => d.shift.end)) }
      : null,
  }
}

/**
 * One stop on a timeline row: the drive to it and the service, so a 4 minute stop is still wide enough to see
 * and grab. Waiting for a window to open is left out, so an early arrival shows as a gap, not a long stop.
 */
export type StopBlock = { orderId: OrderId; trip: number; index: number; start: Minute; end: Minute; eta: Minute; etd: Minute; late: boolean; failed: boolean }

/** The longest drive a stop block shows before service starts. */
const MAX_LEAD = 15

export function stopBlocks(route: Route): StopBlock[] {
  const pause = route.break
  return route.trips.flatMap((trip, t) =>
    trip.stops.map((s, i) => {
      const left = i === 0 ? trip.depart : trip.stops[i - 1].etd
      // A break taken on the way to this stop gets its own block, so this one starts after it.
      const start = Math.max(pause && pause.start >= left && pause.end <= s.eta ? pause.end : left, s.start - MAX_LEAD)
      return {
      orderId: s.orderId,
      trip: t,
      index: i,
      start,
      end: s.etd,
      eta: s.eta,
      etd: s.etd,
      late: s.lateMinutes > 0,
      failed: s.failure !== null,
      }
    }),
  )
}

/** The route's trips as order ids without `orderId`, as the planner sees them when the stop is taken out. */
function tripsWithout(route: Route | undefined, orderId: OrderId) {
  return (route?.trips ?? [])
    .map((t) => ({ depart: t.depart, stops: t.stops.filter((s) => s.orderId !== orderId) }))
    .filter((t) => t.stops.length > 0)
}

/** Where a stop dropped at `minute` on a driver's row lands: in the trip running then, before the stops after it. */
export function dropPosition(route: Route | undefined, orderId: OrderId, minute: Minute): StopPosition {
  const trips = tripsWithout(route, orderId)
  if (!trips.length) return { trip: 0, index: 0 }
  const trip = Math.max(0, trips.findLastIndex((t) => t.depart <= minute))
  return { trip, index: trips[trip].stops.filter((s) => s.start < minute).length }
}

/** The place one stop earlier or later on the same route. Null at either end. */
export function shiftPosition(route: Route, orderId: OrderId, step: -1 | 1): StopPosition | null {
  const t = route.trips.findIndex((trip) => trip.stops.some((s) => s.orderId === orderId))
  if (t < 0) return null
  const i = route.trips[t].stops.findIndex((s) => s.orderId === orderId)
  const alone = route.trips[t].stops.length === 1
  const trips = tripsWithout(route, orderId)
  if (step === -1) {
    if (!alone && i > 0) return { trip: t, index: i - 1 }
    return t > 0 ? { trip: t - 1, index: trips[t - 1].stops.length } : null
  }
  if (!alone && i < trips[t].stops.length) return { trip: t, index: i + 1 }
  const next = alone ? t : t + 1
  return next < trips.length ? { trip: next, index: 0 } : null
}

/** "Budi +9 min · Sari −6 min · +3 km total · all time windows still met". */
export function impactLine(impact: PlanImpact, nameOf: (driverId: DriverId) => string): string {
  const parts = impact.drivers.map((d) => (d.end === null ? `${nameOf(d.driverId)} has no stops left` : `${nameOf(d.driverId)} ${formatMinutesDelta(d.minutesDelta)}`))
  const km = Math.round(impact.kmDelta * 10) / 10
  parts.push(`${km > 0 ? '+' : km < 0 ? '−' : '±'}${Math.abs(km)} km total`)
  parts.push(
    impact.windowsHeld ? 'all time windows still met' : impact.lateStops ? `${impact.lateStops} ${impact.lateStops === 1 ? 'stop' : 'stops'} late` : 'a time window is missed',
  )
  if (impact.unassignedDelta > 0) parts.push(`${impact.unassignedDelta} ${impact.unassignedDelta === 1 ? 'stop no longer fits' : 'stops no longer fit'}`)
  if (impact.unassignedDelta < 0) parts.push(`${-impact.unassignedDelta} more ${impact.unassignedDelta === -1 ? 'stop' : 'stops'} placed`)
  return parts.join(' · ')
}

/** The place just before a live route's next undelivered stop, so a stop handed over is not put in the past. */
export function nextPosition(route: Route, stops: StopProgress[]): StopPosition {
  const pending = new Set(stops.filter((s) => s.status === 'pending').map((s) => s.orderId))
  for (const [t, trip] of route.trips.entries()) {
    const i = trip.stops.findIndex((s) => pending.has(s.orderId))
    if (i >= 0) return { trip: t, index: i }
  }
  const last = route.trips.length - 1
  return last < 0 ? { trip: 0, index: 0 } : { trip: last, index: route.trips[last].stops.length }
}

/** A driver this many minutes behind gets the late alert. */
export const LATE_MINUTES = 10

/** Pending stops whose expected service start is past the end of their time window. */
export function stopsMissingWindow(stops: StopProgress[], orders: ReadonlyMap<OrderId, Order>): StopProgress[] {
  return stops.filter((s) => {
    const window = orders.get(s.orderId)?.window
    return s.status === 'pending' && window != null && s.expectedEta > window.end
  })
}

/** Where a driver is during the live day: at the last stop reached, or at the depot before the first. */
export function liveLocation(stops: StopProgress[], orders: ReadonlyMap<OrderId, Order>, depot: LatLng): LatLng {
  const reached = stops.findLast((s) => s.status === 'done' || s.status === 'arrived')
  const order = reached && orders.get(reached.orderId)
  return order && order.geocode.status !== 'not_found' ? order.geocode.location : depot
}
