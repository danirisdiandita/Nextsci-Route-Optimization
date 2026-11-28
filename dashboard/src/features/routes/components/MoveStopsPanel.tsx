import { X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import type { RouteProgress } from '@/api/mock/clock'
import type { DriverId, Order, OrderId, PlanChangeOp, PlanView, Route } from '@/api/types'
import { RouteDot } from '@/components/RouteDot'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSaveChange } from '@/features/routes/hooks/useSaveChange'
import { nextPosition, stopsMissingWindow } from '@/features/routes/plan'
import { useDrivers } from '@/hooks/useDrivers'
import { usePlanPreview } from '@/hooks/usePlanPreview'
import { useVehicles } from '@/hooks/useVehicles'
import { formatMinute, formatMinutesDelta, formatWindow } from '@/lib/time'

export type LiveRoute = { route: Route; progress: RouteProgress }

type Props = {
  view: PlanView
  from: LiveRoute
  others: LiveRoute[]
  orders: ReadonlyMap<OrderId, Order>
  nameOf: (driverId: DriverId) => string
  onClose: () => void
}

/** Hands a late driver's remaining stops to another driver, previewing what it does to both before it saves. */
export function MoveStopsPanel({ view, from, others, orders, nameOf, onClose }: Props) {
  const pending = from.progress.stops.filter((s) => s.status === 'pending')
  const missing = new Set(stopsMissingWindow(pending, orders).map((s) => s.orderId))
  // Without a stop at risk, offer the two after the one the driver is heading to now.
  const [checked, setChecked] = useState<OrderId[]>(() => (missing.size ? [...missing] : pending.slice(1, 3).map((s) => s.orderId)))
  const { data: vehicles = [] } = useVehicles()
  const { data: drivers = [] } = useDrivers()
  // Minutes left in the driver's shift after the route ends, which a reload trip for the new stops needs.
  const slack = (c: LiveRoute) => (drivers.find((d) => d.id === c.route.driverId)?.shift.end ?? c.route.end) - c.route.end
  const loadOf = (ids: OrderId[]) => ids.reduce((n, id) => n + (orders.get(id)?.quantity ?? 0), 0)
  // Boxes still free on the trip a driver is on now: a stop handed over rides along without a reload.
  const free = (c: LiveRoute) => {
    const capacity = vehicles.find((v) => v.id === c.route.vehicleId)?.capacity ?? 0
    const trip = c.route.trips.find((t) => t.stops.some((s) => s.orderId === c.progress.next?.orderId))
    return capacity - (trip?.load ?? 0)
  }
  const fits = (c: LiveRoute) => free(c) >= loadOf(checked)
  const candidates = [...others].sort(
    (a, b) => Number(fits(b)) - Number(fits(a)) || slack(b) - slack(a) || a.progress.delayMinutes - b.progress.delayMinutes,
  )
  const [picked, setToId] = useState<DriverId | null>(null)
  const toId = picked ?? candidates[0]?.route.driverId ?? null
  const to = candidates.find((c) => c.route.driverId === toId)
  const chosen = pending.filter((s) => checked.includes(s.orderId))
  const at = to && nextPosition(to.route, to.progress.stops)
  const diff: PlanChangeOp[] =
    to && at
      ? chosen.map((s, k) => ({ kind: 'move_stop', orderId: s.orderId, fromDriverId: from.route.driverId, toDriverId: to.route.driverId, at: { trip: at.trip, index: at.index + k } }))
      : []
  const preview = usePlanPreview(view.plan.id, diff)
  const save = useSaveChange()
  const fromName = nameOf(from.route.driverId)
  const toName = to ? nameOf(to.route.driverId) : ''
  const impact = diff.length ? preview.data?.impact : undefined
  const delta = (id: DriverId) => impact?.drivers.find((d) => d.driverId === id)
  const after = preview.data?.routes.find((r) => r.driverId === toId)
  const moved = chosen.map((s) => ({ name: orders.get(s.orderId)?.customer ?? 'Stop', stop: after?.trips.flatMap((t) => t.stops).find((x) => x.orderId === s.orderId) }))
  // A handover that leaves any stop off every route is refused, so no delivery is dropped by accident.
  const strands = !!impact && (moved.some((m) => !m.stop) || impact.unassignedDelta > 0)
  const submit = () =>
    save.mutate(
      { planId: view.plan.id, summary: `Moved ${chosen.length} ${chosen.length === 1 ? 'stop' : 'stops'} from ${fromName} to ${toName}`, diff },
      {
        onSuccess: () => {
          toast.success(`Moved ${chosen.length} ${chosen.length === 1 ? 'stop' : 'stops'} to ${toName}`)
          onClose()
        },
      },
    )

  return (
    <section aria-labelledby="move-title" className="grid gap-4 rounded-xl border bg-card p-4 shadow-[var(--shadow)] sm:p-5">
      <div className="flex items-center justify-between">
        <h2 id="move-title" className="font-[560]">{`Move stops from ${fromName}`}</h2>
        <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
          <X aria-hidden="true" />
        </Button>
      </div>
      {pending.length === 0 ? (
        <p className="text-sm text-muted-foreground">{`${fromName} has no stops left to hand over.`}</p>
      ) : (
        <ul className="max-h-[260px] overflow-y-auto rounded-lg border">
          {pending.map((s) => {
            const order = orders.get(s.orderId)
            const on = checked.includes(s.orderId)
            return (
              <li key={s.orderId} className="border-t first:border-t-0">
                <Label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 font-normal">
                  <Checkbox checked={on} onCheckedChange={(v) => setChecked((ids) => (v ? [...ids, s.orderId] : ids.filter((x) => x !== s.orderId)))} />
                  <span className="min-w-0 flex-1 truncate">{order?.customer ?? 'Stop'}</span>
                  <span className={`shrink-0 text-xs tabular-nums ${missing.has(s.orderId) ? 'text-[var(--warning)]' : 'text-muted-foreground'}`}>
                    {order?.window && `window ${formatWindow(order.window)} · `}
                    {`ETA ${formatMinute(s.expectedEta)}`}
                  </span>
                </Label>
              </li>
            )
          })}
        </ul>
      )}
      <div className="grid gap-2">
        <Label htmlFor="move-to">Give to</Label>
        <Select
          value={toId}
          onValueChange={(v) => setToId(v as DriverId)}
          items={candidates.map((c) => ({ value: c.route.driverId, label: candidateLabel(c, nameOf, free(c)) }))}
        >
          <SelectTrigger id="move-to" className="w-full">
            <SelectValue placeholder="Pick a driver" />
          </SelectTrigger>
          <SelectContent>
            {candidates.map((c) => (
              <SelectItem key={c.route.driverId} value={c.route.driverId}>
                <RouteDot color={c.route.color} />
                {candidateLabel(c, nameOf, free(c))}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {diff.length > 0 && to && (
        <div className="rounded-lg bg-inset p-3 text-sm" aria-live="polite">
          <p className="font-[560]">{`If you move ${chosen.length} ${chosen.length === 1 ? 'stop' : 'stops'} to ${toName}`}</p>
          {impact ? (
            <>
              <p className="mt-1 text-xs text-[var(--text-2)]">
                {`${fromName}: ${formatMinutesDelta(delta(from.route.driverId)?.minutesDelta ?? 0)} · ${toName}: ${formatMinutesDelta(delta(to.route.driverId)?.minutesDelta ?? 0)}`}
                {delta(to.route.driverId)?.end != null && `, back ${formatMinute(delta(to.route.driverId)!.end!)}`}
              </p>
              <p className="mt-1 text-xs text-[var(--text-2)]">
                {moved.map((m) => (m.stop ? `${m.name} ETA ${formatMinute(m.stop.eta)}${m.stop.lateMinutes ? ` (${m.stop.lateMinutes} min late)` : ''}` : `${m.name} does not fit`)).join(', ')}
                {moved.every((m) => m.stop && !m.stop.lateMinutes) && ` · ${moved.length === 1 ? 'inside its window' : 'all inside their windows'}`}
              </p>
              {strands && <p className="mt-1 text-xs text-[var(--danger-text)]">{`${toName} has no time or room left for this. Pick another driver or fewer stops.`}</p>}
            </>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">Working out the impact…</p>
          )}
        </div>
      )}
      {(save.error ?? preview.error) && <p className="text-sm text-[var(--danger-text)]">{(save.error ?? preview.error)!.message}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">Both drivers get the updated route.</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!diff.length || save.isPending || !impact || strands} onClick={submit}>
            {`Move ${chosen.length} ${chosen.length === 1 ? 'stop' : 'stops'}`}
          </Button>
        </div>
      </div>
    </section>
  )
}

const candidateLabel = (c: LiveRoute, nameOf: (id: DriverId) => string, free: number) =>
  `${nameOf(c.route.driverId)} · ${free} ${free === 1 ? 'box' : 'boxes'} free · ${c.progress.delayMinutes ? `${c.progress.delayMinutes} min behind` : 'on time'}`
