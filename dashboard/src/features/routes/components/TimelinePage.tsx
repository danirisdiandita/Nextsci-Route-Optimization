import { Link } from '@tanstack/react-router'
import { ArrowLeftRight, History } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import type { DriverId, Minute, Order, OrderId, PlanChangeOp, PlanView, StopPosition } from '@/api/types'
import { ErrorNotice } from '@/components/ErrorNotice'
import { Button } from '@/components/ui/button'
import { EditTimeline, type EditRow, type KeyMove } from '@/features/routes/components/EditTimeline'
import { PlanHeader } from '@/features/routes/components/PlanHeader'
import { NoPlan } from '@/features/routes/components/RoutesPage'
import { StopDetails } from '@/features/routes/components/StopDetails'
import { useSaveChange } from '@/features/routes/hooks/useSaveChange'
import { dropPosition, impactLine, shiftPosition } from '@/features/routes/plan'
import { useCurrentPlan } from '@/hooks/useCurrentPlan'
import { useDrivers } from '@/hooks/useDrivers'
import { useOrders } from '@/hooks/useOrders'
import { usePlanChanges } from '@/hooks/usePlanChanges'
import { usePlanPreview } from '@/hooks/usePlanPreview'
import { useSimulatedMinute } from '@/hooks/useSimulatedMinute'
import { useUndoChange } from '@/hooks/useUndoChange'

/** One unsaved edit: the op it adds to the change, and how it reads in the change bar. */
type Edit = { op: PlanChangeOp; text: string }

export function TimelinePage() {
  const { data: view, isPending, error } = useCurrentPlan()
  if (isPending) return null
  if (error) return <ErrorNotice error={error} className="m-6" />
  if (!view) return <NoPlan />
  return <PlanTimeline key={view.plan.id} view={view} />
}

function PlanTimeline({ view }: { view: PlanView }) {
  const { plan } = view
  const { data: drivers = [] } = useDrivers()
  const { data: orders = [] } = useOrders()
  const [edits, setEdits] = useState<Edit[]>([])
  const [selectedId, setSelectedId] = useState<OrderId | null>(null)
  const diff = edits.map((e) => e.op)
  const preview = usePlanPreview(plan.id, diff)
  const save = useSaveChange()
  const now = useSimulatedMinute()
  const live = plan.status === 'live'
  const routes = diff.length && preview.data ? preview.data.routes : view.routes
  const byId = new Map<OrderId, Order>(orders.map((o) => [o.id, o]))
  const labelOf = (id: OrderId) => byId.get(id)?.customer ?? 'Stop'
  const nameOf = (id: DriverId) => drivers.find((d) => d.id === id)?.name.split(' ')[0] ?? 'Driver'
  const routeOf = (driverId: DriverId) => routes.find((r) => r.driverId === driverId)
  const impact = diff.length ? preview.data?.impact : undefined
  // A driver in the plan without a route yet still gets a row, so a stop can be dragged to them.
  const driverIds = [...new Set([...routes.map((r) => r.driverId), ...plan.driverIds])].filter((id) => drivers.some((d) => d.id === id && d.vehicleId))
  const colorOf = (id: DriverId) => view.routes.find((r) => r.driverId === id)?.color ?? routes.find((r) => r.driverId === id)?.color ?? 1
  const rows: EditRow[] = driverIds.map((driverId) => {
    const delta = impact?.drivers.find((d) => d.driverId === driverId)?.minutesDelta ?? 0
    return {
      driverId,
      label: nameOf(driverId),
      color: colorOf(driverId),
      route: routeOf(driverId),
      note: delta ? { text: `${delta > 0 ? '+' : '−'}${Math.abs(delta)}m`, tone: delta > 0 ? 'up' : 'down' } : undefined,
    }
  })
  const span = routes.length ? routes : view.routes
  const from = Math.min(...span.map((r) => r.start), ...view.routes.map((r) => r.start))
  const to = Math.max(...span.map((r) => r.end), ...view.routes.map((r) => r.end))

  const moveStop = (orderId: OrderId, fromId: DriverId, toId: DriverId, at: StopPosition | undefined, text: string) => {
    setEdits((list) => [...list, { op: { kind: 'move_stop', orderId, fromDriverId: fromId, toDriverId: toId, ...(at ? { at } : {}) }, text }])
    setSelectedId(orderId)
  }
  const moveText = (orderId: OrderId, fromId: DriverId, toId: DriverId) =>
    fromId === toId ? `Moved ${labelOf(orderId)} on ${nameOf(fromId)}'s route` : `Moved ${labelOf(orderId)} from ${nameOf(fromId)} to ${nameOf(toId)}`
  const drop = (orderId: OrderId, fromId: DriverId, toId: DriverId, minute: Minute) =>
    moveStop(orderId, fromId, toId, dropPosition(routeOf(toId), orderId, minute), moveText(orderId, fromId, toId))
  const keyMove = (orderId: OrderId, driverId: DriverId, m: KeyMove) => {
    if (m === 'earlier' || m === 'later') {
      const route = routeOf(driverId)
      const at = route && shiftPosition(route, orderId, m === 'earlier' ? -1 : 1)
      if (at) moveStop(orderId, driverId, driverId, at, `Moved ${labelOf(orderId)} ${m} on ${nameOf(driverId)}'s route`)
      return
    }
    const i = driverIds.indexOf(driverId) + (m === 'up' ? -1 : 1)
    if (i >= 0 && i < driverIds.length) moveStop(orderId, driverId, driverIds[i], undefined, moveText(orderId, driverId, driverIds[i]))
  }
  const saveEdits = () => {
    const summary = edits.length === 1 ? edits[0].text : `${edits.length} stop moves`
    save.mutate(
      { planId: plan.id, summary, diff },
      {
        onSuccess: () => {
          setEdits([])
          toast.success('Change saved')
        },
      },
    )
  }
  const selectedRoute = selectedId ? routes.find((r) => r.trips.some((t) => t.stops.some((s) => s.orderId === selectedId))) : undefined

  return (
    <section className="flex flex-1 flex-col">
      <PlanHeader view={view} current="timeline" note={edits.length ? `${edits.length} unsaved` : undefined} />
      <div className="grid gap-4 p-4 sm:p-6">
        {live && (
          <p className="rounded-lg border bg-inset px-4 py-3 text-sm text-[var(--text-2)]">
            The day is running. Move stops between drivers from the{' '}
            <Link to="/routes/live" className="text-brand underline-offset-4 hover:underline">
              live view
            </Link>
            .
          </p>
        )}
        <div className="min-w-0 rounded-lg border bg-card p-3">
          <EditTimeline
            rows={rows}
            from={from}
            to={to}
            now={plan.status === 'live' ? now : null}
            labelOf={labelOf}
            ghostIds={new Set(diff.flatMap((op) => (op.kind === 'move_stop' ? [op.orderId] : [])))}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onDrop={live ? null : drop}
            onKeyMove={live ? null : keyMove}
          />
        </div>
        <Legend editable={!live} />
        {selectedId && selectedRoute && (
          <StopDetails
            key={selectedId}
            order={byId.get(selectedId)}
            route={selectedRoute}
            driverName={nameOf(selectedRoute.driverId)}
            targets={driverIds.filter((id) => id !== selectedRoute.driverId).map((id) => ({ driverId: id, name: nameOf(id), color: colorOf(id) }))}
            editable={!live}
            onMoveTo={(toId) => moveStop(selectedId, selectedRoute.driverId, toId, undefined, moveText(selectedId, selectedRoute.driverId, toId))}
            onShift={(step) => keyMove(selectedId, selectedRoute.driverId, step === -1 ? 'earlier' : 'later')}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>
      <div className="sticky bottom-0 mt-auto px-4 pb-4 sm:px-6">
        {edits.length > 0 ? (
          <ChangeBar
            title={edits.length === 1 ? edits[0].text : `${edits.length} stop moves · last: ${edits.at(-1)!.text}`}
            detail={impact ? impactLine(impact, nameOf) : 'Working out the impact…'}
            warn={!!impact && (!impact.windowsHeld || impact.unassignedDelta > 0)}
            error={preview.error ?? save.error}
            busy={save.isPending}
            onUndo={() => setEdits((list) => list.slice(0, -1))}
            onSave={saveEdits}
          />
        ) : (
          !live && <LastChange view={view} />
        )}
      </div>
    </section>
  )
}

function ChangeBar(props: { title: string; detail: string; warn: boolean; error: Error | null; busy: boolean; onUndo: () => void; onSave: () => void }) {
  return (
    <div role="status" className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-[var(--shadow)]">
      <ArrowLeftRight aria-hidden="true" className="size-4 shrink-0 text-brand" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-[560]">{props.title}</p>
        <p className={`text-xs ${props.warn ? 'text-[var(--danger-text)]' : 'text-muted-foreground'}`}>{props.error?.message ?? props.detail}</p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" disabled={props.busy} onClick={props.onUndo}>
          Undo
        </Button>
        <Button disabled={props.busy || !!props.error} onClick={props.onSave}>
          Save change
        </Button>
      </div>
    </div>
  )
}

/** The latest saved change, which the dispatcher can still take back. */
function LastChange({ view }: { view: PlanView }) {
  const { data: changes = [] } = usePlanChanges(view.plan.id)
  const undo = useUndoChange()
  const last = changes.filter((c) => c.status === 'applied').at(-1)
  if (!last?.before) return null
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3">
      <History aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      <p className="min-w-0 flex-1 truncate text-sm">
        <span className="text-muted-foreground">Last change: </span>
        {last.summary}
      </p>
      <Button
        variant="outline"
        size="sm"
        disabled={undo.isPending}
        onClick={() => undo.mutate(last.id, { onSuccess: () => toast.success('Change undone'), onError: (e) => toast.error(e.message) })}
      >
        Undo
      </Button>
    </div>
  )
}

function Legend({ editable }: { editable: boolean }) {
  const swatch = 'inline-block h-3 w-3 rounded-[3px]'
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <li className="flex items-center gap-1.5">
        <span aria-hidden="true" className={swatch} style={{ background: 'var(--route-1)' }} />
        Stop
      </li>
      <li className="flex items-center gap-1.5">
        <span aria-hidden="true" className="inline-block h-3 w-[3px] rounded-full" style={{ background: 'var(--text)' }} />
        Reload at depot
      </li>
      <li className="flex items-center gap-1.5">
        <span aria-hidden="true" className={swatch} style={{ background: 'color-mix(in srgb, var(--text) 10%, transparent)' }} />
        Break
      </li>
      <li className="flex items-center gap-1.5">
        <span aria-hidden="true" className={swatch} style={{ boxShadow: 'inset 0 0 0 1.5px var(--route-1)' }} />
        Moved stop
      </li>
      {editable && <li>Drag a stop to another row or time. Click it to see details, or use the arrow keys.</li>}
    </ul>
  )
}

