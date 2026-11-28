import { Link } from '@tanstack/react-router'
import { Clock, Play, Send } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { routeProgress, type DriverActivity } from '@/api/mock/clock'
import type { DriverId, Order, OrderId, PlanView } from '@/api/types'
import { EmptyState } from '@/components/EmptyState'
import { ErrorNotice } from '@/components/ErrorNotice'
import { HeaderSlot } from '@/components/HeaderSlot'
import { RouteDot } from '@/components/RouteDot'
import { RouteMap } from '@/components/RouteMap'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ClockControls } from '@/features/routes/components/ClockControls'
import { DriverStops } from '@/features/routes/components/DriverStops'
import { MoveStopsPanel, type LiveRoute } from '@/features/routes/components/MoveStopsPanel'
import { NoPlan } from '@/features/routes/components/RoutesPage'
import { LATE_MINUTES, liveLocation, stopsMissingWindow } from '@/features/routes/plan'
import { useCurrentPlan } from '@/hooks/useCurrentPlan'
import { useDayClock } from '@/hooks/useDayClock'
import { useDepots } from '@/hooks/useDepots'
import { useDrivers } from '@/hooks/useDrivers'
import { useIncidents } from '@/hooks/useIncidents'
import { useOrders } from '@/hooks/useOrders'
import { useSimulatedMinute } from '@/hooks/useSimulatedMinute'
import { useStartDay } from '@/hooks/useStartDay'
import { orderLocation } from '@/lib/route'
import { formatDay, formatMinute } from '@/lib/time'

/** The running day: a simulated clock, each driver's progress, the late alert, and handing stops over. */
export function LivePage() {
  const { data: view, isPending, error } = useCurrentPlan()
  if (isPending) return null
  if (error) return <ErrorNotice error={error} className="m-6" />
  if (!view) return <NoPlan />
  if (view.plan.status === 'draft')
    return (
      <EmptyState icon={Send} title="Send the routes first">
        <p className="mt-2 max-w-[440px] text-balance text-muted-foreground">Drivers need their routes before the day can start.</p>
        <Button className="mt-6" nativeButton={false} render={<Link to="/routes" />}>
          Review routes
        </Button>
      </EmptyState>
    )
  if (view.plan.status === 'sent') return <ReadyToStart view={view} />
  return <LiveDay view={view} />
}

function ReadyToStart({ view }: { view: PlanView }) {
  const startDay = useStartDay()
  return (
    <EmptyState icon={Play} title="Routes are with the drivers">
      <p className="mt-2 max-w-[440px] text-balance text-muted-foreground">
        {`Start the day for ${formatDay(view.plan.day)} to follow each driver on a simulated clock.`}
      </p>
      <Button className="mt-6" disabled={startDay.isPending} onClick={() => startDay.mutate(view.plan.id, { onError: (e) => toast.error(e.message) })}>
        <Play aria-hidden="true" />
        Start the day
      </Button>
    </EmptyState>
  )
}

type Panel = { kind: 'move'; driverId: DriverId } | { kind: 'driver'; driverId: DriverId } | null

function LiveDay({ view }: { view: PlanView }) {
  const { data: clock } = useDayClock()
  const minute = useSimulatedMinute()
  const { data: incidents = [] } = useIncidents(view.plan.id)
  const { data: orders = [] } = useOrders()
  const { data: drivers = [] } = useDrivers()
  const { data: depots } = useDepots()
  const [panel, setPanel] = useState<Panel>(null)
  if (!clock || minute === null) return null
  const depot = depots?.find((d) => d.id === view.plan.depotId)
  const byId = new Map<OrderId, Order>(orders.map((o) => [o.id, o]))
  const driverOf = (id: DriverId) => drivers.find((d) => d.id === id)
  const nameOf = (id: DriverId) => driverOf(id)?.name.split(' ')[0] ?? 'Driver'
  const live: LiveRoute[] = view.routes.map((route) => ({ route, progress: routeProgress(route, incidents, minute) }))
  const done = live.reduce((n, l) => n + l.progress.done, 0)
  const total = live.reduce((n, l) => n + l.progress.total, 0)
  const late = live
    .filter((l) => l.progress.delayMinutes >= LATE_MINUTES && l.progress.next)
    .sort((a, b) => b.progress.delayMinutes - a.progress.delayMinutes)[0]
  const lateMissing = late ? stopsMissingWindow(late.progress.stops, byId).length : 0
  const from = Math.min(...view.routes.map((r) => r.start)) - 30
  const to = Math.max(...view.routes.map((r) => r.end)) + 30
  const panelRoute = panel && live.find((l) => l.route.driverId === panel.driverId)
  const lateDriver = late && driverOf(late.route.driverId)

  return (
    <section className="flex flex-1 flex-col">
      <HeaderSlot slot="title">
        <span className="truncate font-[560] max-sm:hidden">{formatDay(view.plan.day)}</span>
        <Badge variant="secondary" className="border-border">
          <span aria-hidden="true" className="size-1.5 rounded-full" style={{ background: clock.kind === 'running' ? 'var(--success)' : 'var(--text-4)' }} />
          {`Live · ${formatMinute(minute)}`}
        </Badge>
      </HeaderSlot>
      <HeaderSlot slot="actions">
        <span className="text-sm whitespace-nowrap text-muted-foreground max-md:hidden">{`${done} of ${total} delivered`}</span>
      </HeaderSlot>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2 lg:px-6">
        <ClockControls clock={clock} minute={minute} from={from} to={to} />
        <span className="text-sm text-muted-foreground md:hidden">{`${done} of ${total} delivered`}</span>
      </div>
      <div className="flex flex-1 flex-col lg:min-h-0 lg:flex-row">
        <div className="flex flex-col border-b lg:w-[380px] lg:shrink-0 lg:overflow-y-auto lg:border-r lg:border-b-0">
          {late && (
            <div role="alert" className="grid gap-2 border-b px-4 py-3 lg:px-6" style={{ background: 'color-mix(in srgb, var(--warning) 10%, transparent)' }}>
              <p className="flex items-center gap-2 text-sm font-[560]">
                <Clock aria-hidden="true" className="size-4 text-[var(--warning)]" />
                {`${nameOf(late.route.driverId)} is ${late.progress.delayMinutes} min behind`}
              </p>
              <p className="text-xs text-[var(--text-2)]">
                {lateMissing
                  ? `${lateMissing} of the next stops will miss their window at this pace.`
                  : 'The next stops still make their windows, but the day ends later.'}
              </p>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setPanel({ kind: 'move', driverId: late.route.driverId })}>
                  Move stops
                </Button>
                {lateDriver?.phone && (
                  <Button variant="outline" size="sm" nativeButton={false} render={<a href={`tel:${lateDriver.phone.replaceAll(' ', '')}`} />}>
                    {`Call ${nameOf(late.route.driverId)}`}
                  </Button>
                )}
              </div>
            </div>
          )}
          <ul aria-label="Drivers">
            {live.map((l) => {
              const id = l.route.driverId
              const active = panel?.driverId === id
              const delay = l.progress.delayMinutes
              return (
                <li key={id} className="border-b">
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => setPanel(active ? null : { kind: 'driver', driverId: id })}
                    className={`grid w-full gap-1.5 px-4 py-3 text-left outline-none hover:bg-muted focus-visible:bg-muted lg:px-6 ${active ? 'bg-brand-soft' : ''}`}
                  >
                    <span className="flex items-center gap-2 text-sm">
                      <RouteDot color={l.route.color} />
                      <span className="flex-1 font-[560]">{nameOf(id)}</span>
                      <span className={`text-xs font-[560] ${delay >= LATE_MINUTES ? 'text-[var(--warning)]' : 'text-[var(--success)]'}`}>
                        {delay ? `+${delay} min` : 'on time'}
                      </span>
                    </span>
                    <span className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <span
                        className="block h-full rounded-full"
                        style={{ width: `${l.progress.total ? (l.progress.done / l.progress.total) * 100 : 0}%`, background: `var(--route-${l.route.color})` }}
                      />
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {`${l.progress.done} of ${l.progress.total} · ${activityText(l.progress.activity, minute, byId)}`}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
        <div className="flex flex-1 flex-col lg:min-h-0">
          {panel && panelRoute ? (
            <div className="p-4 lg:overflow-y-auto lg:p-6">
              {panel.kind === 'move' ? (
                <MoveStopsPanel
                  key={panel.driverId}
                  view={view}
                  from={panelRoute}
                  others={live.filter((l) => l.route.driverId !== panel.driverId)}
                  orders={byId}
                  nameOf={nameOf}
                  onClose={() => setPanel(null)}
                />
              ) : (
                <DriverStops
                  planId={view.plan.id}
                  live={panelRoute}
                  name={nameOf(panel.driverId)}
                  orders={byId}
                  onMove={() => setPanel({ kind: 'move', driverId: panel.driverId })}
                  onClose={() => setPanel(null)}
                />
              )}
            </div>
          ) : (
            depot && (
              <RouteMap
                className="min-h-[360px] flex-1"
                label={`Map of ${live.length} drivers on the road and the stops they have left`}
                depot={depot.location}
                stops={live.flatMap((l) =>
                  l.progress.stops.flatMap((s) => {
                    const order = byId.get(s.orderId)
                    const location = s.status === 'pending' && order && orderLocation(order)
                    return location ? [{ id: s.orderId, location, label: order.customer, color: l.route.color }] : []
                  }),
                )}
                drivers={live.map((l) => ({
                  id: l.route.driverId,
                  label: nameOf(l.route.driverId),
                  color: l.route.color,
                  location: liveLocation(l.progress.stops, byId, depot.location),
                  alert: l.progress.delayMinutes >= LATE_MINUTES,
                }))}
              />
            )
          )}
        </div>
      </div>
    </section>
  )
}

function activityText(a: DriverActivity, minute: number, orders: ReadonlyMap<OrderId, Order>): string {
  const name = (id: OrderId) => orders.get(id)?.customer ?? 'the next stop'
  switch (a.kind) {
    case 'not_started':
      return 'not started'
    case 'loading':
      return 'loading at the depot'
    case 'driving':
      return `driving to ${name(a.to)}`
    case 'at_stop':
      return `at ${name(a.orderId)}`
    case 'held_up':
      return `stuck at ${a.place} for ${Math.max(0, Math.round(minute - a.sinceMinute))} min`
    case 'on_break':
      return 'on a break'
    case 'returning':
      return 'back to the depot'
    case 'finished':
      return 'done for the day'
  }
}
