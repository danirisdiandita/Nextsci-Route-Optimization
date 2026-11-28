import type { Driver, Geocode, Order, OrderField, Vehicle } from '../../api/types.ts'

/** How far a stop's address got: placed on the map, placed but worth a check, or not placed at all. */
export const stopStatuses = ['ready', 'check', 'not_found'] as const
export type StopStatus = (typeof stopStatuses)[number]

export const stopStatusLabel: Record<StopStatus, string> = { ready: 'Ready', check: 'Check address', not_found: 'Not found' }

export function stopStatusOf(geocode: Geocode): StopStatus {
  return geocode.status === 'ok' || geocode.status === 'manual' ? 'ready' : geocode.status
}

export const windowFilters = ['all', 'with', 'without'] as const
export type WindowFilter = (typeof windowFilters)[number]

export type StopFilter = { text: string; status: StopStatus | 'all'; window: WindowFilter }

/** The stops whose name, address, phone, or notes contain the text, with the status and window asked for. */
export function filterStops(orders: Order[], { text, status, window }: StopFilter): Order[] {
  const needle = text.trim().toLowerCase()
  return orders.filter(
    (o) =>
      (status === 'all' || stopStatusOf(o.geocode) === status) &&
      (window === 'all' || (window === 'with') === (o.window !== null)) &&
      (!needle || [o.customer, o.addressRaw, o.phone ?? '', o.notes].some((v) => v.toLowerCase().includes(needle))),
  )
}

export function countByStatus(orders: Order[]): Record<StopStatus, number> {
  const counts: Record<StopStatus, number> = { ready: 0, check: 0, not_found: 0 }
  for (const o of orders) counts[stopStatusOf(o.geocode)]++
  return counts
}

/** Boxes to deliver against what the active drivers' vehicles carry on one trip each. */
export type FleetLoad = { demand: number; perTrip: number; drivers: number }

export function fleetLoad(orders: Order[], drivers: Driver[], vehicles: Vehicle[]): FleetLoad {
  const capacity = new Map(vehicles.map((v) => [v.id, v.capacity]))
  const active = drivers.filter((d) => d.active)
  return {
    demand: orders.reduce((sum, o) => sum + o.quantity, 0),
    perTrip: active.reduce((sum, d) => sum + (d.vehicleId ? (capacity.get(d.vehicleId) ?? 0) : 0), 0),
    drivers: active.length,
  }
}

export const orderFieldLabel: Record<OrderField, string> = {
  customer: 'Customer name',
  address: 'Address',
  phone: 'Phone',
  quantity: 'Load (boxes)',
  window: 'Time window',
  serviceMinutes: 'Service time (min)',
  notes: 'Notes for driver',
}
