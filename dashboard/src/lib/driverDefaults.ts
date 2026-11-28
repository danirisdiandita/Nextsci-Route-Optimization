import type { Driver, DriverBreak, TimeWindow, Vehicle, VehicleKind } from '../api/types.ts'
import { formatMinute, formatWindow, parseWindow } from './time.ts'

/** What a vehicle is, apart from its name and depot. */
export type VehicleSpec = { kind: VehicleKind; capacity: number }

/** The values most drivers share. The drivers screen applies them to every driver at once. */
export type DriverDefaults = { shift: TimeWindow; break: DriverBreak | null; vehicle: VehicleSpec }

/** A driver field that can differ from the defaults. */
export type DefaultField = 'shift' | 'break' | 'kind' | 'capacity'

export const vehicleKindLabel: Record<VehicleKind, string> = { motorbike: 'Motorbike', car: 'Car', van: 'Van' }

/** The defaults of a workspace with no drivers yet: a day shift with lunch, on a motorbike. */
export const startingDefaults: DriverDefaults = {
  shift: { start: 8 * 60, end: 16 * 60 },
  break: { window: { start: 11 * 60 + 30, end: 13 * 60 }, minutes: 30 },
  vehicle: { kind: 'motorbike', capacity: 10 },
}

/** The value that most items share, or `fallback` when there are none. Ties go to the first seen. */
function mostCommon<T>(values: T[], fallback: T): T {
  const counts = new Map<string, { value: T; n: number }>()
  for (const value of values) {
    const key = JSON.stringify(value)
    const entry = counts.get(key) ?? { value, n: 0 }
    entry.n++
    counts.set(key, entry)
  }
  let best: { value: T; n: number } | null = null
  for (const entry of counts.values()) if (!best || entry.n > best.n) best = entry
  return best ? best.value : fallback
}

/**
 * The defaults are not stored: they are what most drivers already have. So a workspace never holds a
 * default that no driver uses, and changing most drivers moves the default with them.
 */
export function deriveDefaults(drivers: Driver[], vehicles: Vehicle[]): DriverDefaults {
  const byId = new Map(vehicles.map((v) => [v.id, v]))
  const specs = drivers.flatMap((d) => {
    const v = d.vehicleId ? byId.get(d.vehicleId) : undefined
    return v ? [v] : []
  })
  return {
    shift: mostCommon(drivers.map((d) => d.shift), startingDefaults.shift),
    break: mostCommon(drivers.map((d) => d.break), startingDefaults.break),
    vehicle: {
      kind: mostCommon(specs.map((v) => v.kind), startingDefaults.vehicle.kind),
      capacity: mostCommon(specs.map((v) => v.capacity), startingDefaults.vehicle.capacity),
    },
  }
}

const sameWindow = (a: TimeWindow, b: TimeWindow) => a.start === b.start && a.end === b.end
const sameBreak = (a: DriverBreak | null, b: DriverBreak | null) =>
  a === null || b === null ? a === b : a.minutes === b.minutes && sameWindow(a.window, b.window)

/** The fields where a driver differs from the defaults. A driver with no vehicle differs in kind and capacity. */
export function differences(driver: Driver, vehicle: Vehicle | undefined, defaults: DriverDefaults): Set<DefaultField> {
  const fields = new Set<DefaultField>()
  if (!sameWindow(driver.shift, defaults.shift)) fields.add('shift')
  if (!sameBreak(driver.break, defaults.break)) fields.add('break')
  if (vehicle?.kind !== defaults.vehicle.kind) fields.add('kind')
  if (vehicle?.capacity !== defaults.vehicle.capacity) fields.add('capacity')
  return fields
}

export const vehicleOf = (driver: Driver, vehicles: Vehicle[]): Vehicle | undefined =>
  driver.vehicleId ? vehicles.find((v) => v.id === driver.vehicleId) : undefined

/** {minutes: 30, 11:30–13:00} → "30 min, 11:30–13:00". */
export function formatBreak(b: DriverBreak | null): string {
  return b ? `${b.minutes} min, ${formatMinute(b.window.start)}–${formatMinute(b.window.end)}` : 'No break'
}

/**
 * "30 min, 11:30–13:00" or "30, 11:30-13:00" → a break, and "" or "no break" → no break. Null when the text
 * is neither, or when the break is longer than its window.
 */
export function parseBreak(text: string): { break: DriverBreak | null } | null {
  const t = text.trim()
  if (!t || /^(no(ne| break)?|-)$/i.test(t)) return { break: null }
  const match = /^(\d+)\s*(?:min(?:utes)?)?\s*[, ]\s*(.+)$/i.exec(t)
  if (!match) return null
  const minutes = Number(match[1])
  const window = parseWindow(match[2])
  if (!window || minutes < 1 || minutes > window.end - window.start) return null
  return { break: { window, minutes } }
}

/** One driver per line, as "name, phone" or "name<tab>phone" from a spreadsheet. A header row is skipped. */
export function parseDriverLines(text: string): { name: string; phone: string | null }[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.split(/\t|,|;/).map((cell) => cell.trim().replace(/^"|"$/g, '')))
    .filter(([name]) => name && !/^(name|driver|nama)$/i.test(name))
    .map(([name, phone]) => ({ name, phone: phone || null }))
}

/** The defaults as the dispatcher types them in the defaults bar. */
export type DefaultsDraft = { shift: string; break: string; kind: VehicleKind; capacity: string }
export type DefaultsErrors = Partial<Record<keyof DefaultsDraft, string>>

export const draftOfDefaults = (d: DriverDefaults): DefaultsDraft => ({
  shift: formatWindow(d.shift),
  break: formatBreak(d.break),
  kind: d.vehicle.kind,
  capacity: String(d.vehicle.capacity),
})

/** Reads the defaults bar, or says which fields to fix. */
export function parseDefaultsDraft(draft: DefaultsDraft): { defaults: DriverDefaults } | { errors: DefaultsErrors } {
  const shift = parseWindow(draft.shift)
  const parsedBreak = parseBreak(draft.break)
  const capacity = parseCapacity(draft.capacity)
  const errors: DefaultsErrors = {}
  if (!shift) errors.shift = 'Write the shift as 08:00–16:00.'
  if (!parsedBreak) errors.break = 'Write the break as 30 min, 11:30–13:00, or leave it empty.'
  if (capacity === null) errors.capacity = 'Capacity is a whole number of boxes, 1 or more.'
  if (!shift || !parsedBreak || capacity === null) return { errors }
  return { defaults: { shift, break: parsedBreak.break, vehicle: { kind: draft.kind, capacity } } }
}

/** "10", "10 boxes" → 10. Null unless it is a whole number of at least 1. */
export function parseCapacity(text: string): number | null {
  const match = /^\s*(\d+)\s*(boxes|box)?\s*$/i.exec(text)
  const n = match ? Number(match[1]) : NaN
  return Number.isInteger(n) && n >= 1 ? n : null
}
