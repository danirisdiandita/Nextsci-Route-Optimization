import { todayDay } from '../../lib/time.ts'
import type {
  AgentMessage,
  AgentMessageId,
  Day,
  Depot,
  Dispatch,
  Driver,
  Incident,
  Minute,
  Order,
  OrderId,
  OrderImport,
  PlanChange,
  PlanGoal,
  PlanSettings,
  PlanView,
  Route,
  Vehicle,
} from '../types.ts'
import { emptyContext, interpretMessage, type Business, type IntentKind, type SetupPatch } from './agentLanguage.ts'
import { businessProfiles, draftFrom, draftQuestions, vehicleLabels, type SetupDraft } from './agentSetup.ts'
import { routeProgress, simulatedMinute } from './clock.ts'
import { query, type Db } from './db.ts'
import { geocode } from './geocode.ts'
import { roadKm } from './geo.ts'
import type { LocationFix } from './order.ts'
import { currentPlan, viewOf } from './planStore.ts'

// What stage the dispatcher's day is in, read from the workspace and the conversation. The Today screen
// shows it, and the agent decides its replies from it. Everything here reads; nothing writes.


/** Everything the agent reads, taken at one moment. */
export type AgentSnapshot = {
  day: Day
  depots: Depot[]
  vehicles: Vehicle[]
  drivers: Driver[]
  orders: Order[]
  imports: OrderImport[]
  /** The newest plan, with its routes. */
  plan: PlanView | null
  /** Changes to the newest plan, oldest first. */
  changes: PlanChange[]
  dispatches: Dispatch[]
  incidents: Incident[]
  messages: AgentMessage[]
  /** The simulated minute of the live day. */
  minute: Minute
}

export function snapshotOf(db: Db, nowMs: number): AgentSnapshot {
  const plan = currentPlan(db)
  const planId = plan?.id
  return {
    day: plan?.day ?? todayDay(),
    depots: db.depot,
    vehicles: db.vehicle,
    drivers: db.driver,
    orders: db.order,
    imports: db.order_import,
    plan: plan && viewOf(db, plan.id),
    changes: db.plan_change.filter((c) => c.planId === planId),
    dispatches: db.dispatch.filter((d) => d.planId === planId),
    incidents: db.incident.filter((i) => i.planId === planId),
    messages: db.agent_message,
    minute: simulatedMinute(db.day_clock, nowMs),
  }
}

export const readSnapshot = () => query((db) => snapshotOf(db, Date.now()))

// ---------------------------------------------------------------------------------------------------------
// What the conversation has settled

/** The dispatcher's own chat messages, from `since` on. */
export const userChats = (messages: AgentMessage[], since = '') => messages.filter((m) => m.role === 'user' && m.kind === 'chat' && m.createdAt >= since)

/** What the dispatcher has said about the operation and the plan they want, read back from the conversation. */
export type Preferences = { setup: SetupPatch[]; business: Business; goal: PlanGoal | null; reloads: boolean | null }

export function preferencesOf(messages: AgentMessage[]): Preferences {
  const prefs: Preferences = { setup: [], business: 'general', goal: null, reloads: null }
  for (const m of userChats(messages)) {
    for (const intent of interpretMessage(m.text, emptyContext)) {
      if (intent.kind === 'describe_operation') {
        prefs.setup.push(intent.setup)
        if (intent.setup.business) prefs.business = intent.setup.business
      } else if (intent.kind === 'set_goal') prefs.goal = intent.goal
      else if (intent.kind === 'finish_earlier') prefs.goal = 'min_time'
      else if (intent.kind === 'allow_reloads') prefs.reloads = intent.allow
    }
  }
  return prefs
}

/** Intents that change what the dispatcher looks at on a draft plan. Any other intent leaves it. */
const planFocusOf: Partial<Record<IntentKind, 'plan' | 'send'>> = {
  send_plan: 'send',
  cancel: 'plan',
  plan: 'plan',
  move_stop: 'plan',
  pin_rule: 'plan',
  remove_driver_today: 'plan',
  set_goal: 'plan',
  finish_earlier: 'plan',
  allow_reloads: 'plan',
}

/** Whether the dispatcher asked to send the draft plan and has not moved on since. */
export function planFocus(messages: AgentMessage[], since: string): 'plan' | 'send' {
  let focus: 'plan' | 'send' = 'plan'
  for (const m of userChats(messages, since)) {
    for (const intent of interpretMessage(m.text, emptyContext)) focus = planFocusOf[intent.kind] ?? focus
  }
  return focus
}

// ---------------------------------------------------------------------------------------------------------
// Orders: what the agent fixed and what needs the dispatcher

export type ReviewRow = { order: Order; note: string }

/** The orders by where their address stands. `fixed` lists orders whose address the geocoder doubted and now has a place. */
export type OrderReview = { total: number; ready: number; fixed: ReviewRow[]; check: ReviewRow[]; needsYou: ReviewRow[] }

export function orderReview(orders: Order[]): OrderReview {
  const review: OrderReview = { total: orders.length, ready: 0, fixed: [], check: [], needsYou: [] }
  for (const order of orders) {
    const g = order.geocode
    // The geocoder is deterministic, so running it again tells what the address gave before anyone fixed it.
    const first = geocode(order.addressRaw)
    if (g.status === 'not_found') review.needsYou.push({ order, note: `No place matches "${order.addressRaw}".` })
    else if (g.status === 'check') review.check.push({ order, note: `"${order.addressRaw}": ${g.reason}. Using ${g.address} for now.` })
    else if (first.status === 'check' && first.candidates.length) {
      review.fixed.push({ order, note: `"${order.addressRaw}" matched ${first.candidates.length} places. Picked ${g.address}.` })
    } else if (first.status === 'check') review.fixed.push({ order, note: `"${order.addressRaw}" has no house number. Placed on ${g.address}.` })
    else if (first.status === 'not_found') review.fixed.push({ order, note: `Pinned by hand at ${g.address}.` })
    else review.ready++
  }
  return review
}

/**
 * How the agent fixes each address the geocoder doubted: of several matches it picks the one nearest the
 * depot, and a street without a number goes in the middle of the street. Orders not found are left alone.
 */
export function locationFixes(orders: Order[], depot: Depot): { orderId: OrderId; fix: LocationFix }[] {
  return orders.flatMap((o): { orderId: OrderId; fix: LocationFix }[] => {
    const g = o.geocode
    if (g.status !== 'check') return []
    if (!g.candidates.length) return [{ orderId: o.id, fix: { kind: 'pin', location: g.location, address: g.address } }]
    const nearest = g.candidates.reduce((best, c, i) =>
      roadKm(c.location, depot.location) < roadKm(g.candidates[best].location, depot.location) ? i : best, 0)
    return [{ orderId: o.id, fix: { kind: 'candidate', index: nearest } }]
  })
}

// ---------------------------------------------------------------------------------------------------------
// Capacity and the plan's settings

/** Drivers a plan can use: active, with a vehicle. */
export const fleet = (s: AgentSnapshot) =>
  s.drivers.flatMap((d) => {
    const vehicle = d.active && d.vehicleId ? s.vehicles.find((v) => v.id === d.vehicleId) : undefined
    return vehicle ? [{ driver: d, vehicle }] : []
  })

export type CapacityCheck = {
  boxes: number
  /** Boxes the whole fleet carries in one trip each. */
  perTrip: number
  vehicles: number
  /** "bikes", "vehicles". */
  vehicleNoun: string
  /** About how many trips each driver makes when they reload. */
  tripsEach: number
  fits: boolean
}

export function capacityCheck(s: AgentSnapshot): CapacityCheck {
  const f = fleet(s)
  const boxes = s.orders.filter((o) => o.geocode.status !== 'not_found').reduce((n, o) => n + o.quantity, 0)
  const perTrip = f.reduce((n, e) => n + e.vehicle.capacity, 0)
  const kinds = new Set(f.map((e) => e.vehicle.kind))
  const vehicleNoun = kinds.size === 1 ? vehicleLabels[[...kinds][0]].many : 'vehicles'
  return { boxes, perTrip, vehicles: f.length, vehicleNoun, tripsEach: perTrip ? Math.ceil(boxes / perTrip) : 0, fits: boxes <= perTrip }
}

export const goalLabels: Record<PlanGoal, string> = {
  min_time: 'the shortest total time',
  balance: 'similar hours for every driver',
  min_drivers: 'the fewest drivers',
}

export function planSettings(s: AgentSnapshot, prefs: Preferences): PlanSettings | null {
  const depot = s.depots[0]
  const driverIds = fleet(s).map((e) => e.driver.id)
  if (!depot || !driverIds.length || !s.orders.length) return null
  const profile = businessProfiles[prefs.business]
  return {
    day: s.day,
    depotId: depot.id,
    driverIds,
    goal: prefs.goal ?? profile.goal,
    allowReloads: prefs.reloads ?? true,
    strictWindows: true,
    serviceMinutes: profile.serviceMinutes,
  }
}

// ---------------------------------------------------------------------------------------------------------
// Sending

export type SendSummary = { app: Driver[]; link: Driver[]; unreachable: Driver[] }

export function sendSummary(s: AgentSnapshot): SendSummary {
  const routed = (s.plan?.routes ?? []).flatMap((r) => s.drivers.filter((d) => d.id === r.driverId))
  return {
    app: routed.filter((d) => d.hasApp),
    link: routed.filter((d) => !d.hasApp && d.phone),
    unreachable: routed.filter((d) => !d.hasApp && !d.phone),
  }
}

// ---------------------------------------------------------------------------------------------------------
// The live day

export type LateStop = { orderId: OrderId; lateBy: number }

/** The stops of a route that will miss their window at the delay the driver has at `minute`. */
export function lateStops(route: Route, incidents: Incident[], orders: Order[], minute: Minute): LateStop[] {
  const progress = routeProgress(route, incidents, minute)
  return route.trips.flatMap((t) =>
    t.stops.flatMap((stop) => {
      const p = progress.stops.find((x) => x.orderId === stop.orderId)
      const window = orders.find((o) => o.id === stop.orderId)?.window
      if (!p || p.status !== 'pending' || !window || p.delayMinutes === 0) return []
      const lateBy = stop.start + p.delayMinutes - window.end
      return lateBy > 0 ? [{ orderId: stop.orderId, lateBy }] : []
    }),
  )
}

/** The id of the log line about an incident, so the agent reports each incident once however often it looks. */
export const incidentMessageId = (incident: Incident) => `agent_message_late_${incident.id.slice('incident_'.length)}` as AgentMessageId

// ---------------------------------------------------------------------------------------------------------
// The stage of the day, which the Today screen shows

export type TodayStage =
  | { kind: 'describe' }
  | { kind: 'draft'; draft: SetupDraft; questions: string[] }
  | { kind: 'orders' }
  | { kind: 'review'; review: OrderReview }
  | { kind: 'goals'; review: OrderReview; capacity: CapacityCheck; goal: PlanGoal; reloads: boolean; backBy: Minute }
  | { kind: 'plan'; view: PlanView; proposal: PlanChange | null }
  | { kind: 'send'; view: PlanView; send: SendSummary }
  | { kind: 'sent'; view: PlanView; send: SendSummary; dispatches: Dispatch[] }
  | { kind: 'live'; view: PlanView; proposal: PlanChange | null; incidents: Incident[] }

export type StageKind = TodayStage['kind']

export type TodayView = { day: Day; depot: Depot | null; stage: TodayStage }

/** The newest change waiting for the dispatcher to apply or discard. */
export const openProposal = (s: AgentSnapshot) => s.changes.filter((c) => c.status === 'proposed').at(-1) ?? null

export function todayStage(s: AgentSnapshot): TodayStage {
  const view = s.plan
  if (view?.plan.status === 'live') return { kind: 'live', view, proposal: openProposal(s), incidents: s.incidents }
  if (view?.plan.status === 'sent') return { kind: 'sent', view, send: sendSummary(s), dispatches: s.dispatches }
  if (view) {
    const proposal = openProposal(s)
    if (!proposal && planFocus(s.messages, view.plan.createdAt) === 'send') return { kind: 'send', view, send: sendSummary(s) }
    return { kind: 'plan', view, proposal }
  }
  const prefs = preferencesOf(s.messages)
  if (!s.depots.length || !fleet(s).length) {
    if (!prefs.setup.length) return { kind: 'describe' }
    const draft = draftFrom(prefs.setup)
    return { kind: 'draft', draft, questions: draftQuestions(draft) }
  }
  if (!s.orders.length) return { kind: 'orders' }
  const review = orderReview(s.orders)
  if (review.needsYou.length || review.check.length) return { kind: 'review', review }
  const settings = planSettings(s, prefs)!
  return {
    kind: 'goals',
    review,
    capacity: capacityCheck(s),
    goal: settings.goal,
    reloads: settings.allowReloads,
    backBy: Math.max(...fleet(s).map((e) => e.driver.shift.end)),
  }
}

export const todayViewOf = (s: AgentSnapshot): TodayView => ({ day: s.day, depot: s.depots[0] ?? null, stage: todayStage(s) })

/** What Today shows: the stage of the day and what it needs. */
export const getToday = () => query((db) => todayViewOf(snapshotOf(db, Date.now())))

