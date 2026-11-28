import type { DayClock, Incident, Minute, OrderId, Route, RouteStopStatus } from '../types.ts'

// The live day runs on a simulated clock. Nothing ticks in storage: a running clock stores when it started,
// and the current minute is derived from the real time. Stop statuses are derived from the minute too.

/** The simulated minute of the day at real time `nowMs`. */
export function simulatedMinute(clock: DayClock, nowMs: number): Minute {
  if (clock.kind === 'paused') return clock.minute
  return clock.anchorMinute + ((nowMs - clock.anchorEpochMs) / 60_000) * clock.speed
}

export function pauseClock(clock: DayClock, nowMs: number): DayClock {
  return clock.kind === 'paused' ? clock : { kind: 'paused', minute: simulatedMinute(clock, nowMs), speed: clock.speed }
}

export function runClock(clock: DayClock, nowMs: number): DayClock {
  return clock.kind === 'running' ? clock : { kind: 'running', anchorMinute: clock.minute, anchorEpochMs: nowMs, speed: clock.speed }
}

/** Changes the speed without a jump in the simulated time. */
export function setClockSpeed(clock: DayClock, speed: number, nowMs: number): DayClock {
  return clock.kind === 'paused'
    ? { ...clock, speed }
    : { kind: 'running', anchorMinute: simulatedMinute(clock, nowMs), anchorEpochMs: nowMs, speed }
}

export function setClockMinute(clock: DayClock, minute: Minute, nowMs: number): DayClock {
  return clock.kind === 'paused' ? { ...clock, minute } : { ...clock, anchorMinute: minute, anchorEpochMs: nowMs }
}

export type StopProgress = {
  orderId: OrderId
  status: RouteStopStatus
  /** The arrival expected now, after any delay. */
  expectedEta: Minute
  /** Minutes the expected service start is past the planned one. */
  delayMinutes: number
}

/** Where a driver is at one minute of the live day. */
export type DriverActivity =
  | { kind: 'not_started' }
  | { kind: 'loading' }
  | { kind: 'driving'; to: OrderId }
  | { kind: 'at_stop'; orderId: OrderId }
  | { kind: 'held_up'; place: string; sinceMinute: Minute }
  | { kind: 'on_break' }
  | { kind: 'returning' }
  | { kind: 'finished' }

export type RouteProgress = {
  stops: StopProgress[]
  done: number
  total: number
  next: StopProgress | null
  /** How far behind plan the driver is now. */
  delayMinutes: number
  activity: DriverActivity
}

/**
 * The state of a route at `minute`. Each incident that has started delays every stop planned after it.
 * A stop with a recorded failure stays failed.
 */
export function routeProgress(route: Route, incidents: Incident[], minute: Minute): RouteProgress {
  const started = incidents.filter((i) => i.driverId === route.driverId && i.at <= minute)
  const delayAt = (t: Minute) => started.filter((i) => i.at <= t).reduce((sum, i) => sum + i.delayMinutes, 0)
  const stops: StopProgress[] = route.trips.flatMap((trip) =>
    trip.stops.map((s) => {
      const delay = delayAt(s.eta)
      const status: RouteStopStatus = s.failure
        ? 'failed'
        : minute >= s.etd + delay
          ? 'done'
          : minute >= s.eta + delay
            ? 'arrived'
            : 'pending'
      return { orderId: s.orderId, status, expectedEta: s.eta + delay, delayMinutes: delay }
    }),
  )
  const next = stops.find((s) => s.status === 'pending' || s.status === 'arrived') ?? null
  return {
    stops,
    done: stops.filter((s) => s.status === 'done').length,
    total: stops.length,
    next,
    delayMinutes: next?.delayMinutes ?? delayAt(minute),
    activity: activityAt(route, started, minute, stops),
  }
}

function activityAt(route: Route, started: Incident[], minute: Minute, stops: StopProgress[]): DriverActivity {
  const holdup = started.find((i) => minute < i.at + i.delayMinutes)
  if (holdup) return { kind: 'held_up', place: holdup.place, sinceMinute: holdup.at }
  if (minute < route.start) return { kind: 'not_started' }
  if (route.break && minute >= route.break.start && minute < route.break.end) return { kind: 'on_break' }
  const here = stops.find((s) => s.status === 'arrived')
  if (here) return { kind: 'at_stop', orderId: here.orderId }
  const next = stops.find((s) => s.status === 'pending')
  if (!next) return minute >= route.end ? { kind: 'finished' } : { kind: 'returning' }
  const index = route.trips.findIndex((t) => t.stops.some((s) => s.orderId === next.orderId))
  const delay = next.delayMinutes
  if (index > 0 && minute < route.trips[index - 1].return + delay) return { kind: 'returning' }
  if (index >= 0 && minute < route.trips[index].depart + delay) return { kind: 'loading' }
  return { kind: 'driving', to: next.orderId }
}
