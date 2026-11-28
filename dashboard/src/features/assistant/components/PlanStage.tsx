import { Link } from '@tanstack/react-router'
import { Send } from 'lucide-react'
import type { Depot, Driver, Order, OrderId, PlanChange, PlanView, Route } from '@/api/types'
import { RouteDot } from '@/components/RouteDot'
import { RouteMap } from '@/components/RouteMap'
import { Timeline, type TimelineRow } from '@/components/Timeline'
import { AskButton, Panel, StageActions, StageColumn, StageHeading, ToneBadge } from '@/features/assistant/components/TodayParts'
import { useDrivers } from '@/hooks/useDrivers'
import { useOrders } from '@/hooks/useOrders'
import { usePlanPreview } from '@/hooks/usePlanPreview'
import { routePaths, routeTimelineItems, stopCount } from '@/lib/route'
import { formatDuration, formatMinute, formatMinutesDelta } from '@/lib/time'

const km = (n: number) => `${n.toLocaleString('en-GB', { maximumFractionDigits: 1 })} km`
const signedKm = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(n).toLocaleString('en-GB', { maximumFractionDigits: 1 })} km`

/** Design NS 05, or NS 06 while the agent's change waits for the dispatcher. */
export function PlanStage({ view, proposal, depot }: { view: PlanView; proposal: PlanChange | null; depot: Depot | null }) {
  const { data: drivers } = useDrivers()
  const { data: orders } = useOrders()
  if (!drivers || !orders) return null
  return proposal ? (
    <ChangePreview view={view} proposal={proposal} drivers={drivers} orders={orders} />
  ) : (
    <PlanReady view={view} depot={depot} drivers={drivers} orders={orders} />
  )
}

function PlanReady({ view, depot, drivers, orders }: { view: PlanView; depot: Depot | null; drivers: Driver[]; orders: Order[] }) {
  const { routes, unassigned } = view
  const byId = new Map(orders.map((o) => [o.id, o]))
  const late = routes.reduce((n, r) => n + r.trips.reduce((m, t) => m + t.stops.filter((s) => s.lateMinutes > 0).length, 0), 0)
  const lastBack = routes.length ? Math.max(...routes.map((r) => r.end)) : null
  const shiftEnd = Math.max(...drivers.filter((d) => view.plan.driverIds.includes(d.id)).map((d) => d.shift.end))
  const hours = routes.map((r) => r.durationMin)
  const name = (r: Route) => drivers.find((d) => d.id === r.driverId)?.name ?? 'Driver'
  return (
    <StageColumn>
      <StageHeading
        title={`Plan ready · ${routes.length} routes`}
        aside={
          unassigned.length || late ? (
            <ToneBadge tone="warning">{[unassigned.length && `${unassigned.length} left out`, late && `${late} late`].filter(Boolean).join(' · ')}</ToneBadge>
          ) : (
            <ToneBadge tone="success">All goals met</ToneBadge>
          )
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Distance" value={km(routes.reduce((n, r) => n + r.distanceKm, 0))} note={`${routes.reduce((n, r) => n + stopCount(r), 0)} stops on ${routes.length} routes`} />
        <Stat
          label="Last driver back"
          value={lastBack === null ? '–' : formatMinute(lastBack)}
          note={lastBack === null ? '' : lastBack <= shiftEnd ? `${shiftEnd - lastBack} min before ${formatMinute(shiftEnd)}` : `${lastBack - shiftEnd} min after ${formatMinute(shiftEnd)}`}
        />
        <Stat label="Hours per driver" value={hours.length ? `${formatDuration(Math.min(...hours))} – ${formatDuration(Math.max(...hours))}` : '–'} note={`${view.plan.allowReloads ? 'Reloads on' : 'One trip each'}, version ${view.plan.version}`} />
      </div>
      <RouteMap
        label={`Map of ${routes.length} routes`}
        depot={depot?.location ?? null}
        routes={depot ? routes.map((r) => ({ id: r.id, color: r.color, paths: routePaths(r, byId, depot.location) })) : []}
        className="h-80 rounded-xl border"
      />
      <Panel className="p-0">
        <ul className="divide-y text-sm">
          {routes.slice(0, 3).map((r) => (
            <li key={r.id} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 px-4 py-3 sm:grid-cols-[minmax(140px,1fr)_auto_auto_auto]">
              <span className="flex min-w-0 items-center gap-2 font-[560] text-foreground">
                <RouteDot color={r.color} />
                <span className="truncate">{name(r)}</span>
              </span>
              <span className="text-muted-foreground">{`${stopCount(r)} stops · ${r.trips.length} trip${r.trips.length === 1 ? '' : 's'}`}</span>
              <span className="text-muted-foreground tabular-nums max-sm:hidden">{km(r.distanceKm)}</span>
              <span className="text-muted-foreground tabular-nums max-sm:hidden">{`${formatMinute(r.start)} – ${formatMinute(r.end)}`}</span>
            </li>
          ))}
          {routes.length > 3 && (
            <li className="px-4 py-2.5 text-xs">
              <Link to="/routes" className="text-muted-foreground hover:text-foreground">{`… ${routes.length - 3} more routes`}</Link>
            </li>
          )}
        </ul>
      </Panel>
      <StageActions note={<Link to="/routes/timeline" className="text-brand hover:underline">Open the timeline</Link>}>
        <AskButton say="Send to drivers">
          <Send aria-hidden="true" />
          Send to drivers
        </AskButton>
      </StageActions>
    </StageColumn>
  )
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <Panel className="py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tracking-[-0.01em] tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{note}</p>
    </Panel>
  )
}

/** The stops a change moves, so the timeline can draw where they were and where they go. */
const movedOrders = (change: PlanChange): OrderId[] =>
  change.diff.flatMap((op) => (op.kind === 'move_stop' || op.kind === 'assign_stop' || op.kind === 'pin_stop' ? [op.orderId] : []))

function ChangePreview({ view, proposal, drivers, orders }: { view: PlanView; proposal: PlanChange; drivers: Driver[]; orders: Order[] }) {
  const preview = usePlanPreview(view.plan.id, proposal.diff)
  const routes = preview.data?.routes ?? view.routes
  const customer = new Map<string, string>(orders.map((o) => [o.id, o.customer]))
  const moved = movedOrders(proposal)
  const name = (driverId: string) => drivers.find((d) => d.id === driverId)?.name ?? 'Driver'
  // Each moved stop shows as an outline where it was, and highlighted where it goes.
  const ghosts = view.routes.map((r) => ({
    driverId: r.driverId,
    items: r.trips.flatMap((t) =>
      t.stops
        .filter((s) => moved.includes(s.orderId))
        .map((s) => ({ id: `was-${s.orderId}`, kind: 'stop' as const, start: s.start, end: s.etd, label: `${customer.get(s.orderId)} (before)`, orderId: s.orderId })),
    ),
  }))
  const rows: TimelineRow[] = routes.map((r) => {
    const delta = proposal.impact.drivers.find((d) => d.driverId === r.driverId)
    const stillHere = new Set(r.trips.flatMap((t) => t.stops.map((s) => s.orderId)))
    const ghost = (ghosts.find((g) => g.driverId === r.driverId)?.items ?? []).filter((g) => !stillHere.has(g.orderId))
    return {
      id: r.id,
      color: r.color,
      label: name(r.driverId),
      note: delta && delta.minutesDelta !== 0 ? formatMinutesDelta(delta.minutesDelta) : undefined,
      items: [...routeTimelineItems(r, (id) => customer.get(id) ?? 'Stop'), ...ghost],
    }
  })
  const from = Math.min(...routes.map((r) => r.start))
  const to = Math.max(...routes.map((r) => r.end))
  const changed = proposal.impact.drivers.filter((d) => d.minutesDelta !== 0 || d.kmDelta !== 0 || d.end === null)
  return (
    <StageColumn>
      <StageHeading title="Timeline" aside={<ToneBadge tone="brand">Previewing a change</ToneBadge>} />
      <Panel className="overflow-x-auto">
        <div className="min-w-[560px] pr-5">
          <Timeline
            rows={rows}
            from={from}
            to={to}
            highlightedIds={new Set(moved)}
            ghostIds={new Set(moved.map((id) => `was-${id}`))}
          />
        </div>
      </Panel>
      <Panel className="border-ring">
        <h3 className="text-sm font-[560]">{proposal.summary}</h3>
        <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-3 text-xs">
          {changed.slice(0, 4).map((d) => (
            <div key={d.driverId}>
              <dt className="text-muted-foreground">{name(d.driverId)}</dt>
              <dd className="mt-0.5" style={{ color: d.end === null ? 'var(--warning)' : d.minutesDelta <= 0 ? 'var(--success)' : 'var(--warning)' }}>
                {d.end === null ? 'no route' : `${formatMinutesDelta(d.minutesDelta)} · ${signedKm(d.kmDelta)}`}
              </dd>
            </div>
          ))}
          <div>
            <dt className="text-muted-foreground">Plan total</dt>
            <dd className="mt-0.5" style={{ color: proposal.impact.kmDelta <= 0 ? 'var(--success)' : 'var(--warning)' }}>
              {`${formatMinutesDelta(proposal.impact.minutesDelta)} · ${signedKm(proposal.impact.kmDelta)}`}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Time windows</dt>
            <dd className="mt-0.5" style={{ color: proposal.impact.windowsHeld ? 'var(--success)' : 'var(--danger-text)' }}>
              {proposal.impact.windowsHeld ? 'all still met' : `${proposal.impact.lateStops} late`}
            </dd>
          </div>
          {proposal.impact.unassignedDelta !== 0 && (
            <div>
              <dt className="text-muted-foreground">Left out</dt>
              <dd className="mt-0.5" style={{ color: proposal.impact.unassignedDelta > 0 ? 'var(--danger-text)' : 'var(--success)' }}>
                {`${proposal.impact.unassignedDelta > 0 ? '+' : '−'}${Math.abs(proposal.impact.unassignedDelta)} stops`}
              </dd>
            </div>
          )}
        </dl>
        <StageActions>
          <AskButton variant="outline" say="Discard" />
          <AskButton say="Apply change" />
        </StageActions>
      </Panel>
    </StageColumn>
  )
}
