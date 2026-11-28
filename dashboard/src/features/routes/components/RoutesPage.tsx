import { Link } from '@tanstack/react-router'
import { Route as RouteIcon } from 'lucide-react'
import { useState } from 'react'
import type { Order, OrderId, PlanView, Route } from '@/api/types'
import { EmptyState } from '@/components/EmptyState'
import { ErrorNotice } from '@/components/ErrorNotice'
import { RouteDot } from '@/components/RouteDot'
import { RouteMap, type MapStop } from '@/components/RouteMap'
import { Button } from '@/components/ui/button'
import { PlanHeader } from '@/features/routes/components/PlanHeader'
import { UnassignedList } from '@/features/routes/components/UnassignedList'
import { useCurrentPlan } from '@/hooks/useCurrentPlan'
import { useDepots } from '@/hooks/useDepots'
import { useDispatches } from '@/hooks/useDispatches'
import { useDrivers } from '@/hooks/useDrivers'
import { useOrders } from '@/hooks/useOrders'
import { useVehicles } from '@/hooks/useVehicles'
import { orderLocation, routePaths, stopCount } from '@/lib/route'
import { formatMinute } from '@/lib/time'

const channelLabel = { app: 'App', sms: 'SMS', whatsapp: 'WhatsApp' } as const

/** The planned day: totals, each driver's route, the stops left over, and the map. */
export function RoutesPage() {
  const { data: view, isPending, error } = useCurrentPlan()
  if (isPending) return null
  if (error) return <ErrorNotice error={error} className="m-6" />
  if (!view) return <NoPlan />
  return <PlannedRoutes view={view} />
}

export function NoPlan() {
  return (
    <EmptyState icon={RouteIcon} title="No routes yet">
      <p className="mt-2 max-w-[440px] text-balance text-muted-foreground">Plan a day to see each driver's route here.</p>
      <Button className="mt-6" nativeButton={false} render={<Link to="/routes/new" />}>
        Plan routes
      </Button>
    </EmptyState>
  )
}

function PlannedRoutes({ view }: { view: PlanView }) {
  const { data: depots } = useDepots()
  const { data: orders = [] } = useOrders()
  const { data: drivers = [] } = useDrivers()
  const { data: vehicles = [] } = useVehicles()
  const { data: dispatches = [] } = useDispatches(view.plan.id)
  const [selected, setSelected] = useState<Route['id'] | null>(null)
  const [hovered, setHovered] = useState<Route['id'] | null>(null)
  const depot = depots?.find((d) => d.id === view.plan.depotId)
  const byId = new Map<OrderId, Order>(orders.map((o) => [o.id, o]))
  const focus = hovered ?? selected
  const allStops = view.routes.flatMap((r) => r.trips.flatMap((t) => t.stops))
  const km = view.routes.reduce((n, r) => n + r.distanceKm, 0)
  const lastBack = view.routes.length ? Math.max(...view.routes.map((r) => r.end)) : null
  const late = allStops.filter((s) => s.lateMinutes > 0).length
  // Every route leaves the same depot, so drawing every line reads as a starburst. With no route picked, the
  // colored stops show each driver's area. Picking a route draws its lines alone.
  const stops: MapStop[] = view.routes.flatMap((r) =>
    focus && r.id !== focus
      ? []
      : r.trips.flatMap((t) =>
          t.stops.flatMap((s) => {
            const order = byId.get(s.orderId)
            const location = order && orderLocation(order)
            return location ? [{ id: s.orderId, location, label: order.customer, color: r.color }] : []
          }),
        ),
  )
  const sent = view.plan.status !== 'draft'
  return (
    <section className="flex flex-1 flex-col">
      <PlanHeader view={view} current="map" />
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-b px-4 py-3 sm:grid-cols-3 lg:grid-cols-5 lg:px-6">
        <Stat label="Routes" value={String(view.routes.length)} />
        <Stat label="Stops planned" value={`${allStops.length} / ${allStops.length + view.unassigned.length}`} />
        <Stat label="Distance" value={`${Math.round(km)} km`} />
        <Stat label="Last driver back" value={lastBack === null ? '–' : formatMinute(lastBack)} />
        <Stat label="Late stops" value={String(late)} tone={late ? 'danger' : 'success'} />
      </dl>
      <div className="flex flex-1 flex-col lg:min-h-0 lg:flex-row">
        <div className="flex flex-col border-b lg:w-[400px] lg:shrink-0 lg:overflow-y-auto lg:border-r lg:border-b-0">
          <table className="w-full text-sm" aria-label="Routes">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium lg:pl-6">Driver</th>
                <th className="px-2 py-2 font-medium">Stops</th>
                <th className="px-2 py-2 font-medium">Trips</th>
                <th className="px-2 py-2 font-medium">Back</th>
                {sent && <th className="px-2 py-2 font-medium">Sent</th>}
              </tr>
            </thead>
            <tbody>
              {view.routes.map((route) => {
                const driver = drivers.find((d) => d.id === route.driverId)
                const vehicle = vehicles.find((v) => v.id === route.vehicleId)
                const dispatch = dispatches.findLast((d) => d.driverId === route.driverId)
                const active = route.id === selected
                return (
                  <tr
                    key={route.id}
                    className={`cursor-pointer border-t hover:bg-muted ${active ? 'bg-brand-soft' : ''}`}
                    onMouseEnter={() => setHovered(route.id)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => setSelected(active ? null : route.id)}
                  >
                    <td className="px-4 py-2.5 lg:pl-6">
                      <button
                        type="button"
                        className="flex items-center gap-2 font-[560] outline-none focus-visible:underline"
                        aria-pressed={active}
                        onFocus={() => setHovered(route.id)}
                        onBlur={() => setHovered(null)}
                      >
                        <RouteDot color={route.color} />
                        {driver?.name.split(' ')[0] ?? 'Driver'}
                        {vehicle && vehicle.kind !== 'motorbike' && <span className="font-normal text-muted-foreground">{`· ${vehicle.kind}`}</span>}
                      </button>
                    </td>
                    <td className="px-2 py-2.5 tabular-nums">{stopCount(route)}</td>
                    <td className="px-2 py-2.5 tabular-nums">{route.trips.length}</td>
                    <td className="px-2 py-2.5 tabular-nums">{formatMinute(route.end)}</td>
                    {sent && <td className="px-2 py-2.5 text-muted-foreground">{dispatch ? channelLabel[dispatch.channel] : 'Not sent'}</td>}
                  </tr>
                )
              })}
            </tbody>
          </table>
          <UnassignedList view={view} orders={byId} drivers={drivers} />
        </div>
        {depot && (
          <RouteMap
            className="min-h-[360px] flex-1"
            label={`Map of ${view.routes.length} routes from ${depot.name}`}
            depot={depot.location}
            routes={view.routes.filter((r) => r.id === focus).map((r) => ({ id: r.id, color: r.color, paths: routePaths(r, byId, depot.location) }))}
            stops={stops}
          />
        )}
      </div>
    </section>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'success' | 'danger' }) {
  const color = tone === 'success' ? 'text-[var(--success)]' : tone === 'danger' ? 'text-[var(--danger-text)]' : ''
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`text-lg font-[560] tabular-nums ${color}`}>{value}</dd>
    </div>
  )
}
