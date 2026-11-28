import type { DayClock, Incident, Minute, OrderId, PlanId } from '../types.ts'
import { pauseClock, runClock, setClockMinute, setClockSpeed } from './clock.ts'
import { must, mutate, newId, query } from './db.ts'
import { viewOf } from './planStore.ts'
import { requireText } from './validate.ts'

/** What the dispatcher does to the simulated clock. */
export type ClockAction =
  | { kind: 'run' }
  | { kind: 'pause' }
  | { kind: 'speed'; speed: number }
  | { kind: 'seek'; minute: Minute }

export const getDayClock = () => query((db) => db.day_clock)

export const setDayClock = (action: ClockAction) =>
  mutate((db): DayClock => {
    const nowMs = Date.now()
    const clock = db.day_clock
    db.day_clock =
      action.kind === 'run'
        ? runClock(clock, nowMs)
        : action.kind === 'pause'
          ? pauseClock(clock, nowMs)
          : action.kind === 'speed'
            ? setClockSpeed(clock, action.speed, nowMs)
            : setClockMinute(clock, action.minute, nowMs)
    return db.day_clock
  })

/**
 * Starts the live day for a sent plan: the clock runs from just before the first driver leaves, at 10
 * simulated minutes per real minute. For the demo, the second route runs into traffic halfway through its day.
 */
export const startDay = (planId: PlanId) =>
  mutate((db) => {
    const plan = must(db.plan, planId, 'plan')
    if (plan.status !== 'sent') throw new Error(plan.status === 'live' ? 'The day is already running.' : 'Send the routes before you start the day.')
    const routes = db.route.filter((r) => r.planId === planId)
    if (!routes.length) throw new Error('This plan has no routes.')
    plan.status = 'live'
    const first = Math.min(...routes.map((r) => r.start))
    db.day_clock = { kind: 'running', anchorMinute: first - 10, anchorEpochMs: Date.now(), speed: 10 }
    const slowed = routes[1] ?? routes[0]
    db.incident = db.incident.filter((i) => i.planId !== planId)
    db.incident.push({
      id: newId('incident'),
      planId,
      driverId: slowed.driverId,
      at: Math.round((slowed.start + slowed.end) / 2),
      delayMinutes: 25,
      place: 'Jl. Malioboro',
    })
    return viewOf(db, planId)
  })

export const listIncidents = (planId: PlanId) => query((db) => db.incident.filter((i) => i.planId === planId))

export const addIncident = (input: Omit<Incident, 'id'>) =>
  mutate((db) => {
    must(db.plan, input.planId, 'plan')
    const incident: Incident = { id: newId('incident'), ...input, place: requireText(input.place, 'Place') }
    db.incident.push(incident)
    return incident
  })

/** Marks a stop on a live route as not delivered. */
export const failStop = (planId: PlanId, orderId: OrderId, reason: string) =>
  mutate((db) => {
    const stop = db.route
      .filter((r) => r.planId === planId)
      .flatMap((r) => r.trips.flatMap((t) => t.stops))
      .find((s) => s.orderId === orderId)
    if (!stop) throw new Error('This stop is not on a route of this plan.')
    stop.failure = { reason: requireText(reason, 'Reason') }
    return viewOf(db, planId)
  })
