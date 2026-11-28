// Domain types shared by every feature. They mirror the backend ERD and stay the same when an API module
// switches from the mock server in src/api/mock/ to fetch. Table and entity names are singular.

declare const brand: unique symbol
type Brand<T, B extends string> = T & { readonly [brand]: B }

export const entityNames = [
  'depot',
  'vehicle',
  'driver',
  'order',
  'order_import',
  'plan',
  'route',
  'plan_change',
  'dispatch',
  'agent_message',
  'incident',
] as const
export type EntityName = (typeof entityNames)[number]

/** An id such as `driver_k3x9q2`. The prefix names the entity, so ids of two entities never mix. */
export type Id<E extends EntityName> = Brand<string, E>
export type DepotId = Id<'depot'>
export type VehicleId = Id<'vehicle'>
export type DriverId = Id<'driver'>
export type OrderId = Id<'order'>
export type OrderImportId = Id<'order_import'>
export type PlanId = Id<'plan'>
export type RouteId = Id<'route'>
export type PlanChangeId = Id<'plan_change'>
export type DispatchId = Id<'dispatch'>
export type AgentMessageId = Id<'agent_message'>
export type IncidentId = Id<'incident'>

/** Reads an id from a URL or a form. Null when the text is not an id of that entity. */
export function parseId<E extends EntityName>(entity: E, raw: string): Id<E> | null {
  return raw.startsWith(`${entity}_`) && raw.length > entity.length + 1 ? (raw as Id<E>) : null
}

/** A calendar day as `YYYY-MM-DD`, in the dispatcher's local time. */
export type Day = Brand<string, 'day'>

/** Minutes after midnight on a plan's day: 480 is 08:00. */
export type Minute = number

/** An ISO 8601 timestamp of a real moment, such as when a row was created. */
export type Timestamp = string

export type LatLng = { lat: number; lng: number }

export type TimeWindow = { start: Minute; end: Minute }

export type Depot = {
  id: DepotId
  name: string
  address: string
  location: LatLng
  hours: TimeWindow
  /** Minutes to load a vehicle before each trip. */
  loadMinutes: number
}

export const vehicleKinds = ['motorbike', 'car', 'van'] as const
export type VehicleKind = (typeof vehicleKinds)[number]

export type Vehicle = {
  id: VehicleId
  name: string
  kind: VehicleKind
  /** Boxes the vehicle carries on one trip. */
  capacity: number
  depotId: DepotId
}

export type DriverBreak = { window: TimeWindow; minutes: number }

/** Where the driver's day starts. Every route ends at the depot. */
export type DriverStart = { kind: 'depot' } | { kind: 'home'; address: string; location: LatLng }

export type Driver = {
  id: DriverId
  name: string
  /** Null when the dispatcher has not added a number, so the driver cannot get a link by SMS. */
  phone: string | null
  vehicleId: VehicleId | null
  shift: TimeWindow
  break: DriverBreak | null
  start: DriverStart
  /** False when the driver is off. Plans leave inactive drivers out by default. */
  active: boolean
  /** True when the driver signed in to the Nextsci app, so routes go to the app instead of a link. */
  hasApp: boolean
}

export type GeocodeCandidate = { address: string; location: LatLng }

/** Where an order's address landed on the map. */
export type Geocode =
  | { status: 'ok'; address: string; location: LatLng }
  /** A best guess that the dispatcher should confirm. `reason` says why, such as "2 matches". */
  | { status: 'check'; address: string; location: LatLng; reason: string; candidates: GeocodeCandidate[] }
  | { status: 'not_found' }
  /** The dispatcher placed the pin by hand. */
  | { status: 'manual'; address: string; location: LatLng }

export type GeocodeStatus = Geocode['status']

/** A stop to deliver. The backend calls it an order. */
export type Order = {
  id: OrderId
  customer: string
  phone: string | null
  /** The address as typed or imported. */
  addressRaw: string
  geocode: Geocode
  /** Boxes to deliver. */
  quantity: number
  /** Minutes at the stop. Null uses the plan's service time. */
  serviceMinutes: number | null
  window: TimeWindow | null
  notes: string
  importId: OrderImportId | null
}

/** The order fields a spreadsheet column can fill. */
export const orderFields = ['customer', 'address', 'phone', 'quantity', 'window', 'serviceMinutes', 'notes'] as const
export type OrderField = (typeof orderFields)[number]

/** For each order field, the index of the column that fills it, or null when no column does. */
export type ColumnMapping = Record<OrderField, number | null>

export type OrderImport = {
  id: OrderImportId
  fileName: string
  columns: string[]
  rows: string[][]
  mapping: ColumnMapping
  createdAt: Timestamp
  /** Set when the rows became orders. */
  committedAt: Timestamp | null
}

export const planGoals = ['min_time', 'balance', 'min_drivers'] as const
export type PlanGoal = (typeof planGoals)[number]

/** draft: routes exist and can change. sent: drivers have their routes. live: the day is running. */
export const planStatuses = ['draft', 'sent', 'live'] as const
export type PlanStatus = (typeof planStatuses)[number]

/** What the dispatcher chooses before planning. */
export type PlanSettings = {
  day: Day
  depotId: DepotId
  driverIds: DriverId[]
  goal: PlanGoal
  allowReloads: boolean
  strictWindows: boolean
  /** Minutes at each stop whose order does not set its own. */
  serviceMinutes: number
}

/** A stop the dispatcher keeps on one driver when the plan is solved again. */
export type Pin = { orderId: OrderId; driverId: DriverId }

export type Plan = PlanSettings & {
  id: PlanId
  pins: Pin[]
  status: PlanStatus
  /** Goes up by one each time the routes change, so a driver can tell an old route from a new one. */
  version: number
  notify: { customers: boolean; onChange: boolean }
  createdAt: Timestamp
}

/** One of the six route colors in design.css, `--route-1` to `--route-6`. */
export type RouteColor = 1 | 2 | 3 | 4 | 5 | 6

/** A stop on a route, with the solved times. */
export type RouteStop = {
  orderId: OrderId
  /** Arrival. */
  eta: Minute
  /** Service begins: the arrival, or the window start when the driver is early. */
  start: Minute
  /** Departure. */
  etd: Minute
  /** Minutes after the window end that service begins. Zero when on time or when the order has no window. */
  lateMinutes: number
  /** Set when the stop could not be delivered. */
  failure: { reason: string } | null
}

/** One loop from the depot and back: load, deliver, return. */
export type Trip = { depart: Minute; return: Minute; load: number; stops: RouteStop[] }

export type Route = {
  id: RouteId
  planId: PlanId
  driverId: DriverId
  vehicleId: VehicleId
  color: RouteColor
  trips: Trip[]
  /** Where the solver placed the driver's break, or null when the driver has none. */
  break: TimeWindow | null
  start: Minute
  end: Minute
  distanceKm: number
  durationMin: number
}

export const unassignedReasons = ['no_location', 'missed_window', 'over_capacity', 'past_shift', 'no_driver'] as const
export type UnassignedReason = (typeof unassignedReasons)[number]

export type UnassignedOrder = { planId: PlanId; orderId: OrderId; reason: UnassignedReason }

/** A place on a route: before stop `index` of trip `trip`, counted without the stop being moved. */
export type StopPosition = { trip: number; index: number }

/** One edit to a plan. A change holds one or more. */
export type PlanChangeOp =
  /** Without `at`, the stop goes where it costs the receiving driver least. */
  | { kind: 'move_stop'; orderId: OrderId; fromDriverId: DriverId; toDriverId: DriverId; at?: StopPosition }
  | { kind: 'assign_stop'; orderId: OrderId; toDriverId: DriverId }
  | { kind: 'unassign_stop'; orderId: OrderId }
  | { kind: 'remove_driver'; driverId: DriverId }
  | { kind: 'add_driver'; driverId: DriverId }
  | { kind: 'pin_stop'; orderId: OrderId; driverId: DriverId }
  | { kind: 'set_goal'; goal: PlanGoal }
  | { kind: 'set_reloads'; allowReloads: boolean }
  | { kind: 'set_strict_windows'; strictWindows: boolean }

export type PlanChangeOpKind = PlanChangeOp['kind']

export type DriverImpact = {
  driverId: DriverId
  minutesDelta: number
  kmDelta: number
  /** When the driver is back at the depot after the change. Null when the change removes the route. */
  end: Minute | null
}

/** What a change does to the plan, compared with the routes before it. */
export type PlanImpact = {
  drivers: DriverImpact[]
  minutesDelta: number
  kmDelta: number
  /** True when no stop that was on time becomes late. */
  windowsHeld: boolean
  lateStops: number
  unassignedDelta: number
}

export const planChangeStatuses = ['proposed', 'applied', 'rejected', 'undone'] as const
export type PlanChangeStatus = (typeof planChangeStatuses)[number]

/** The settings a change can edit. */
export type PlanRules = Pick<Plan, 'driverIds' | 'goal' | 'allowReloads' | 'strictWindows' | 'pins'>

/** A plan's routes and rules at one moment. A change keeps the ones it replaced, so it can be undone. */
export type PlanSnapshot = { version: number; rules: PlanRules; routes: Route[]; unassigned: UnassignedOrder[] }

export type PlanChange = {
  id: PlanChangeId
  planId: PlanId
  authorKind: 'user' | 'agent'
  summary: string
  diff: PlanChangeOp[]
  impact: PlanImpact
  status: PlanChangeStatus
  /** The routes before the change was applied. Null until then. */
  before: PlanSnapshot | null
  createdAt: Timestamp
}

export const dispatchChannels = ['app', 'sms', 'whatsapp'] as const
export type DispatchChannel = (typeof dispatchChannels)[number]

export type Dispatch = {
  id: DispatchId
  planId: PlanId
  driverId: DriverId
  channel: DispatchChannel
  /** The token in the link that opens the route without an app account. */
  linkToken: string
  routeVersion: number
  sentAt: Timestamp
}

export type AgentMessage = {
  id: AgentMessageId
  role: 'user' | 'agent'
  /** chat: a turn in the conversation. event: a line in today's log, such as "Sent 10 routes". */
  kind: 'chat' | 'event'
  text: string
  /** File names attached to a user message. */
  attachments: string[]
  /** Replies the dispatcher can pick, such as "Send to drivers". */
  suggestions: string[]
  proposalId: PlanChangeId | null
  /** The simulated time of an event, shown in today's log. */
  at: Minute | null
  createdAt: Timestamp
}

/** Something that delays a driver during the live day. Every stop after `at` slips by `delayMinutes`. */
export type Incident = {
  id: IncidentId
  planId: PlanId
  driverId: DriverId
  at: Minute
  delayMinutes: number
  place: string
}

/** The simulated clock of the live day. Running time moves `speed` simulated minutes per real minute. */
export type DayClock =
  | { kind: 'paused'; minute: Minute; speed: number }
  | { kind: 'running'; anchorMinute: Minute; anchorEpochMs: number; speed: number }

/** What the dispatcher has set up, derived from the data. The setup checklist and the `/` redirect read it. */
export type Workspace = {
  setup: { depot: boolean; drivers: boolean; stops: boolean; plan: boolean }
  counts: { depots: number; vehicles: number; drivers: number; orders: number; plans: number }
  currentPlanId: PlanId | null
}

/** A plan with its solved routes and the orders it could not place. */
export type PlanView = { plan: Plan; routes: Route[]; unassigned: UnassignedOrder[] }

export type RouteStopStatus = 'pending' | 'arrived' | 'done' | 'failed'
