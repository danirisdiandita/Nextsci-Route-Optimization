import type {
  AgentMessage,
  DayClock,
  Depot,
  Dispatch,
  Driver,
  DriverBreak,
  DriverStart,
  EntityName,
  Geocode,
  GeocodeCandidate,
  Id,
  Incident,
  LatLng,
  Order,
  OrderField,
  OrderImport,
  Plan,
  PlanChange,
  PlanChangeOp,
  PlanImpact,
  PlanRules,
  PlanSnapshot,
  Pin,
  Route,
  RouteStop,
  TimeWindow,
  Trip,
  UnassignedOrder,
  Vehicle,
} from '../types.ts'
import {
  dispatchChannels,
  orderFields,
  planChangeStatuses,
  planGoals,
  planStatuses,
  unassignedReasons,
  vehicleKinds,
} from '../types.ts'
import { arrayOf, boolean, id, literal, nullable, number, recordOf, shape, string, union, type Guard } from './guard.ts'

// The mock server's database: every table in one versioned localStorage key. Each call reads the whole
// database, works on it, and writes it back in one synchronous step after a short delay, so loading states
// show and two calls never interleave their writes.

export const STORAGE_KEY = 'nextsci.mock.v1'

export type Db = {
  version: 1
  depot: Depot[]
  vehicle: Vehicle[]
  driver: Driver[]
  order: Order[]
  order_import: OrderImport[]
  plan: Plan[]
  route: Route[]
  unassigned_order: UnassignedOrder[]
  plan_change: PlanChange[]
  dispatch: Dispatch[]
  agent_message: AgentMessage[]
  incident: Incident[]
  day_clock: DayClock
  /** The field the dispatcher chose for each spreadsheet header, by lowercase header. */
  import_mapping: Record<string, OrderField>
}

/** A workspace with nothing set up, so the dashboard opens on onboarding. */
export function emptyDb(): Db {
  return {
    version: 1,
    depot: [],
    vehicle: [],
    driver: [],
    order: [],
    order_import: [],
    plan: [],
    route: [],
    unassigned_order: [],
    plan_change: [],
    dispatch: [],
    agent_message: [],
    incident: [],
    day_clock: { kind: 'paused', minute: 8 * 60, speed: 10 },
    import_mapping: {},
  }
}

const latLng = shape<LatLng>({ lat: number, lng: number })
const timeWindow = shape<TimeWindow>({ start: number, end: number })
const candidate = shape<GeocodeCandidate>({ address: string, location: latLng })

const geocode = union<Geocode>(
  shape<Extract<Geocode, { status: 'ok' }>>({ status: literal('ok'), address: string, location: latLng }),
  shape<Extract<Geocode, { status: 'check' }>>({
    status: literal('check'),
    address: string,
    location: latLng,
    reason: string,
    candidates: arrayOf(candidate),
  }),
  shape<Extract<Geocode, { status: 'not_found' }>>({ status: literal('not_found') }),
  shape<Extract<Geocode, { status: 'manual' }>>({ status: literal('manual'), address: string, location: latLng }),
)

const depot = shape<Depot>({ id: id('depot'), name: string, address: string, location: latLng, hours: timeWindow, loadMinutes: number })
const vehicle = shape<Vehicle>({ id: id('vehicle'), name: string, kind: literal(...vehicleKinds), capacity: number, depotId: id('depot') })
const driverStart = union<DriverStart>(
  shape<Extract<DriverStart, { kind: 'depot' }>>({ kind: literal('depot') }),
  shape<Extract<DriverStart, { kind: 'home' }>>({ kind: literal('home'), address: string, location: latLng }),
)
const driver = shape<Driver>({
  id: id('driver'),
  name: string,
  phone: nullable(string),
  vehicleId: nullable(id('vehicle')),
  shift: timeWindow,
  break: nullable(shape<DriverBreak>({ window: timeWindow, minutes: number })),
  start: driverStart,
  active: boolean,
  hasApp: boolean,
})
const order = shape<Order>({
  id: id('order'),
  customer: string,
  phone: nullable(string),
  addressRaw: string,
  geocode,
  quantity: number,
  serviceMinutes: nullable(number),
  window: nullable(timeWindow),
  notes: string,
  importId: nullable(id('order_import')),
})
const columnMapping = shape<Record<OrderField, number | null>>(
  Object.fromEntries(orderFields.map((f) => [f, nullable(number)])) as Record<OrderField, Guard<number | null>>,
)
const orderImport = shape<OrderImport>({
  id: id('order_import'),
  fileName: string,
  columns: arrayOf(string),
  rows: arrayOf(arrayOf(string)),
  mapping: columnMapping,
  createdAt: string,
  committedAt: nullable(string),
})
const pin = shape<Pin>({ orderId: id('order'), driverId: id('driver') })
const plan = shape<Plan>({
  id: id('plan'),
  day: string as Guard<Plan['day']>,
  depotId: id('depot'),
  driverIds: arrayOf(id('driver')),
  goal: literal(...planGoals),
  allowReloads: boolean,
  strictWindows: boolean,
  serviceMinutes: number,
  pins: arrayOf(pin),
  status: literal(...planStatuses),
  version: number,
  notify: shape<Plan['notify']>({ customers: boolean, onChange: boolean }),
  createdAt: string,
})
const routeStop = shape<RouteStop>({
  orderId: id('order'),
  eta: number,
  start: number,
  etd: number,
  lateMinutes: number,
  failure: nullable(shape<{ reason: string }>({ reason: string })),
})
const route = shape<Route>({
  id: id('route'),
  planId: id('plan'),
  driverId: id('driver'),
  vehicleId: id('vehicle'),
  color: literal(1, 2, 3, 4, 5, 6),
  trips: arrayOf(shape<Trip>({ depart: number, return: number, load: number, stops: arrayOf(routeStop) })),
  break: nullable(timeWindow),
  start: number,
  end: number,
  distanceKm: number,
  durationMin: number,
})
const unassignedOrder = shape<UnassignedOrder>({ planId: id('plan'), orderId: id('order'), reason: literal(...unassignedReasons) })
type Op<K extends PlanChangeOp['kind']> = Extract<PlanChangeOp, { kind: K }>
const planChangeOp = union<PlanChangeOp>(
  shape<Op<'move_stop'>>({ kind: literal('move_stop'), orderId: id('order'), fromDriverId: id('driver'), toDriverId: id('driver') }),
  shape<Op<'assign_stop'>>({ kind: literal('assign_stop'), orderId: id('order'), toDriverId: id('driver') }),
  shape<Op<'unassign_stop'>>({ kind: literal('unassign_stop'), orderId: id('order') }),
  shape<Op<'remove_driver'>>({ kind: literal('remove_driver'), driverId: id('driver') }),
  shape<Op<'add_driver'>>({ kind: literal('add_driver'), driverId: id('driver') }),
  shape<Op<'pin_stop'>>({ kind: literal('pin_stop'), orderId: id('order'), driverId: id('driver') }),
  shape<Op<'set_goal'>>({ kind: literal('set_goal'), goal: literal(...planGoals) }),
  shape<Op<'set_reloads'>>({ kind: literal('set_reloads'), allowReloads: boolean }),
  shape<Op<'set_strict_windows'>>({ kind: literal('set_strict_windows'), strictWindows: boolean }),
)
const impact = shape<PlanImpact>({
  drivers: arrayOf(
    shape<PlanImpact['drivers'][number]>({ driverId: id('driver'), minutesDelta: number, kmDelta: number, end: nullable(number) }),
  ),
  minutesDelta: number,
  kmDelta: number,
  windowsHeld: boolean,
  lateStops: number,
  unassignedDelta: number,
})
const planChange = shape<PlanChange>({
  id: id('plan_change'),
  planId: id('plan'),
  authorKind: literal('user', 'agent'),
  summary: string,
  diff: arrayOf(planChangeOp),
  impact,
  status: literal(...planChangeStatuses),
  before: nullable(
    shape<PlanSnapshot>({
      version: number,
      rules: shape<PlanRules>({
        driverIds: arrayOf(id('driver')),
        goal: literal(...planGoals),
        allowReloads: boolean,
        strictWindows: boolean,
        pins: arrayOf(pin),
      }),
      routes: arrayOf(route),
      unassigned: arrayOf(unassignedOrder),
    }),
  ),
  createdAt: string,
})
const dispatch = shape<Dispatch>({
  id: id('dispatch'),
  planId: id('plan'),
  driverId: id('driver'),
  channel: literal(...dispatchChannels),
  linkToken: string,
  routeVersion: number,
  sentAt: string,
})
const agentMessage = shape<AgentMessage>({
  id: id('agent_message'),
  role: literal('user', 'agent'),
  kind: literal('chat', 'event'),
  text: string,
  attachments: arrayOf(string),
  suggestions: arrayOf(string),
  proposalId: nullable(id('plan_change')),
  at: nullable(number),
  createdAt: string,
})
const incident = shape<Incident>({ id: id('incident'), planId: id('plan'), driverId: id('driver'), at: number, delayMinutes: number, place: string })
const dayClock = union<DayClock>(
  shape<Extract<DayClock, { kind: 'paused' }>>({ kind: literal('paused'), minute: number, speed: number }),
  shape<Extract<DayClock, { kind: 'running' }>>({ kind: literal('running'), anchorMinute: number, anchorEpochMs: number, speed: number }),
)

const isDb = shape<Db>({
  version: literal(1),
  depot: arrayOf(depot),
  vehicle: arrayOf(vehicle),
  driver: arrayOf(driver),
  order: arrayOf(order),
  order_import: arrayOf(orderImport),
  plan: arrayOf(plan),
  route: arrayOf(route),
  unassigned_order: arrayOf(unassignedOrder),
  plan_change: arrayOf(planChange),
  dispatch: arrayOf(dispatch),
  agent_message: arrayOf(agentMessage),
  incident: arrayOf(incident),
  day_clock: dayClock,
  import_mapping: recordOf(literal(...orderFields)),
})

/** Parses stored text into a database. Null when it is missing, not JSON, or not this version's shape. */
export function parseDb(text: string | null): Db | null {
  if (text === null) return null
  try {
    const value: unknown = JSON.parse(text)
    return isDb(value) ? value : null
  } catch {
    return null
  }
}

// Private windows and blocked storage throw on access. The database then lives in memory until reload.
let memory: string | null = null
const storage = {
  get(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEY)
    } catch {
      return memory
    }
  },
  set(text: string) {
    try {
      localStorage.setItem(STORAGE_KEY, text)
    } catch {
      memory = text
    }
  },
}

/** Reads the database. Missing or unreadable data starts an empty workspace, which opens on onboarding. */
export function readDb(): Db {
  const text = storage.get()
  const db = parseDb(text)
  if (db) return db
  if (text !== null) console.warn(`Stored mock data under ${STORAGE_KEY} is not readable, so the workspace starts empty.`)
  const empty = emptyDb()
  writeDb(empty)
  return empty
}

export function writeDb(db: Db) {
  storage.set(JSON.stringify(db))
}

let latencyMs = 150

/** How long every mock call waits, so loading states are real. Tests set it to 0. */
export function setMockLatency(ms: number) {
  latencyMs = ms
}

const wait = () => (latencyMs > 0 ? new Promise((resolve) => setTimeout(resolve, latencyMs)) : Promise.resolve())

/** Runs a read against a fresh copy of the database. */
export async function query<T>(read: (db: Db) => T): Promise<T> {
  await wait()
  return read(readDb())
}

/** Runs a change and saves it, unless `change` throws, which leaves the database as it was. */
export async function mutate<T>(change: (db: Db) => T): Promise<T> {
  await wait()
  const db = readDb()
  const result = change(db)
  writeDb(db)
  return result
}

export function newId<E extends EntityName>(entity: E): Id<E> {
  return `${entity}_${crypto.randomUUID().replaceAll('-', '').slice(0, 10)}` as Id<E>
}

export const now = () => new Date().toISOString()

/** Finds a row or throws an error the dispatcher can read, such as "This driver no longer exists." */
export function must<T extends { id: string }>(rows: T[], rowId: string, noun: string): T {
  const row = rows.find((r) => r.id === rowId)
  if (!row) throw new Error(`This ${noun} no longer exists.`)
  return row
}
