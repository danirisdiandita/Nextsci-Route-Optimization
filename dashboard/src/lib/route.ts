import type { LatLng, Minute, Order, OrderId, Route, RouteColor } from '@/api/types'

/** The CSS color of a route, from the six route tokens in design.css. */
export const routeColorVar = (color: RouteColor) => `var(--route-${color})`

/** Where an order is on the map, or null when its address was not found. */
export const orderLocation = (order: Order): LatLng | null => (order.geocode.status === 'not_found' ? null : order.geocode.location)

/** Each trip of a route as a line on the map: from the depot, through its stops, back to the depot. */
export function routePaths(route: Route, orders: ReadonlyMap<OrderId, Order>, depot: LatLng): LatLng[][] {
  return route.trips.map((trip) => [
    depot,
    ...trip.stops.flatMap((s) => {
      const order = orders.get(s.orderId)
      const loc = order && orderLocation(order)
      return loc ? [loc] : []
    }),
    depot,
  ])
}

export const stopCount = (route: Route) => route.trips.reduce((n, t) => n + t.stops.length, 0)

/** One block on a timeline row. */
export type TimelineItem = {
  id: string
  kind: 'stop' | 'break' | 'reload'
  start: Minute
  end: Minute
  label: string
}

/**
 * A route as timeline blocks: each stop from service start to departure, the break, and a reload marker
 * where the driver is back at the depot between two trips. `label` names a stop, such as its customer.
 */
export function routeTimelineItems(route: Route, label: (orderId: OrderId) => string): TimelineItem[] {
  const items: TimelineItem[] = route.trips.flatMap((trip, i) => [
    ...(i > 0 ? [{ id: `reload-${i}`, kind: 'reload' as const, start: trip.depart, end: trip.depart, label: 'Reload at depot' }] : []),
    ...trip.stops.map((s) => ({ id: s.orderId, kind: 'stop' as const, start: s.start, end: s.etd, label: label(s.orderId) })),
  ])
  if (route.break) items.push({ id: 'break', kind: 'break', start: route.break.start, end: route.break.end, label: 'Break' })
  return items.sort((a, b) => a.start - b.start)
}
