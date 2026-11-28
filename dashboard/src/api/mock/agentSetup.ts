import { formatMinute, formatWindow } from '../../lib/time.ts'
import type { DepotId, DriverBreak, Geocode, PlanGoal, TimeWindow, VehicleId, VehicleKind } from '../types.ts'
import type { DriverInput } from './driver.ts'
import { geocode } from './geocode.ts'
import type { Business, SetupPatch } from './agentLanguage.ts'
import type { DepotInput } from './depot.ts'
import type { VehicleInput } from './vehicle.ts'

// The setup the agent drafts from a description, before anything is saved. Each description the dispatcher
// writes is a patch. The draft folds the patches in order, so a later "make it 8 drivers" wins, and fills
// what nobody said with a default it names as an assumption.

/** What each kind of business means for planning. */
export const businessProfiles: Record<Business, { label: string; note: string; serviceMinutes: number; goal: PlanGoal; noun: string }> = {
  food: { label: 'Food delivery', note: 'Short stops, and every delivery window is kept strictly.', serviceMinutes: 4, goal: 'min_time', noun: 'kitchen' },
  grocery: { label: 'Grocery delivery', note: 'Longer drops for heavier bags. Windows are kept strictly.', serviceMinutes: 6, goal: 'min_time', noun: 'store' },
  parcel: { label: 'Parcel delivery', note: 'Quick drops and many stops per trip.', serviceMinutes: 3, goal: 'min_time', noun: 'warehouse' },
  general: { label: 'Delivery', note: 'Five minutes per stop until you tell me otherwise.', serviceMinutes: 5, goal: 'min_time', noun: 'depot' },
}

export const vehicleLabels: Record<VehicleKind, { one: string; many: string; capacity: number }> = {
  motorbike: { one: 'motorbike', many: 'motorbikes', capacity: 10 },
  car: { one: 'car', many: 'cars', capacity: 40 },
  van: { one: 'van', many: 'vans', capacity: 80 },
}

const DEFAULT_SHIFT: TimeWindow = { start: 8 * 60, end: 16 * 60 }

export type SetupDraft = {
  business: Business
  /** Null until the dispatcher says where the depot is. */
  address: string | null
  /** Where the address landed on the map. Null without an address. */
  geocode: Geocode | null
  /** Null until the dispatcher says how many drivers there are. */
  drivers: number | null
  vehicleKind: VehicleKind
  capacity: number
  shift: TimeWindow
  break: DriverBreak | null
  /** What the agent filled in because no description said it, as sentences such as "I assumed shifts run 08:00–16:00". */
  assumptions: string[]
}

/** The draft from every description so far, oldest first. */
export function draftFrom(patches: SetupPatch[]): SetupDraft {
  // A later break detail, such as "lunch takes 45 minutes", keeps the earlier time of the break.
  const said = patches.reduce<SetupPatch>(
    (all, p) => ({ ...all, ...p, ...(p.break && all.break ? { break: { ...all.break, ...p.break } } : {}) }),
    {},
  )
  const assumptions: string[] = []
  const vehicleKind = said.vehicleKind ?? 'motorbike'
  if (!said.vehicleKind && said.drivers) assumptions.push(`I assumed everyone rides a ${vehicleLabels[vehicleKind].one}`)
  const capacity = said.capacity ?? vehicleLabels[vehicleKind].capacity
  if (said.capacity === undefined && said.drivers) assumptions.push(`I assumed each ${vehicleLabels[vehicleKind].one} carries ${capacity} boxes`)
  const shift = said.shift ?? DEFAULT_SHIFT
  if (!said.shift && said.drivers) assumptions.push(`I assumed shifts run ${formatWindow(shift)}`)
  let lunch: DriverBreak | null = null
  if (said.break) {
    const minutes = said.break.minutes ?? 30
    if (said.break.minutes === undefined) assumptions.push(`I assumed the break takes ${minutes} min`)
    const around = said.break.around ?? 12 * 60
    const window = said.break.window ?? { start: around, end: around + 60 }
    if (!said.break.window) assumptions.push(`I assumed the break can start any time ${formatWindow(window)}`)
    lunch = { window, minutes }
  }
  const address = said.address ?? null
  return {
    business: said.business ?? 'general',
    address,
    geocode: address ? geocode(address) : null,
    drivers: said.drivers ?? null,
    vehicleKind,
    capacity,
    shift,
    break: lunch,
    assumptions,
  }
}

/** What the draft still needs before it can be saved, as questions the agent asks. Empty when it is ready. */
export function draftQuestions(draft: SetupDraft): string[] {
  const questions: string[] = []
  if (!draft.address) questions.push('Where do your drivers load? Tell me the street and the area.')
  else if (draft.geocode?.status === 'not_found') questions.push(`I couldn't find "${draft.address}" on the map. Tell me the street name, such as Jl. Layur VII.`)
  if (draft.drivers === null) questions.push('How many drivers do you have, and what do they ride?')
  if (draft.break && draft.break.window.start < draft.shift.start) questions.push('The break starts before the shift does. When can drivers take it?')
  return questions
}

export const draftReady = (draft: SetupDraft) => draftQuestions(draft).length === 0

/** "Driver 001", the name the agent gives each driver it creates. */
export const driverName = (n: number) => `Driver ${String(n).padStart(3, '0')}`

/** "Driver 001 – 010", or "Driver 001" for one driver. */
export const driverRange = (count: number) => (count === 1 ? driverName(1) : `${driverName(1)} – ${driverName(count).slice(-3)}`)

/** The depot the draft describes, or null when it cannot be placed yet. */
export function depotInput(draft: SetupDraft): DepotInput | null {
  const place = draft.geocode
  if (!draft.address || !place || place.status === 'not_found') return null
  const end = Math.max(draft.shift.end, draft.break?.window.end ?? 0)
  return {
    name: `Main ${businessProfiles[draft.business].noun}`,
    address: draft.address,
    location: place.location,
    hours: { start: draft.shift.start, end },
    loadMinutes: 10,
  }
}

export function vehicleInputs(draft: SetupDraft, depotId: DepotId): VehicleInput[] {
  const label = vehicleLabels[draft.vehicleKind].one
  return Array.from({ length: draft.drivers ?? 0 }, (_, i) => ({
    name: `${label[0].toUpperCase()}${label.slice(1)} ${String(i + 1).padStart(2, '0')}`,
    kind: draft.vehicleKind,
    capacity: draft.capacity,
    depotId,
  }))
}

/** One driver per vehicle. The description gives no phone numbers, so each driver gets a link only after one is added. */
export function driverInputs(draft: SetupDraft, vehicleIds: VehicleId[], numbering: number): DriverInput[] {
  return vehicleIds.map((vehicleId, i) => ({
    name: driverName(numbering + i),
    phone: null,
    vehicleId,
    shift: draft.shift,
    break: draft.break,
    start: { kind: 'depot' },
    active: true,
    hasApp: false,
  }))
}

/** The sentence a draft edit sends to the agent, which reads back as the same fields. */
export function describeDepot(address: string): string {
  return `Our depot is at ${address.trim()}.`
}

export function describeBusiness(business: Business): string {
  return business === 'general' ? "We're a general delivery business." : `We're a ${business} delivery business.`
}

export function describeFleet(fleet: Pick<SetupDraft, 'drivers' | 'vehicleKind' | 'capacity' | 'shift' | 'break'>): string {
  const v = vehicleLabels[fleet.vehicleKind]
  const n = fleet.drivers ?? 1
  const lunch = fleet.break
    ? `with a ${fleet.break.minutes} min break between ${formatMinute(fleet.break.window.start)} and ${formatMinute(fleet.break.window.end)}`
    : 'with no break'
  return `${n} driver${n === 1 ? '' : 's'} on ${n === 1 ? v.one : v.many}, ${formatMinute(fleet.shift.start)} to ${formatMinute(fleet.shift.end)} ${lunch}. Each ${v.one} carries ${fleet.capacity} boxes.`
}

/** "10 motorbikes · 10 boxes each". */
export function fleetSummary(draft: SetupDraft): string {
  const v = vehicleLabels[draft.vehicleKind]
  const n = draft.drivers
  return n === null ? `${v.many} · ${draft.capacity} boxes each` : `${n} ${n === 1 ? v.one : v.many} · ${draft.capacity} boxes each`
}

