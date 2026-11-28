import { ArrowLeft, ArrowRight, X } from 'lucide-react'
import type { DriverId, Order, Route, RouteColor } from '@/api/types'
import { RouteDot } from '@/components/RouteDot'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatMinute, formatWindow } from '@/lib/time'

type Props = {
  order: Order | undefined
  route: Route
  driverName: string
  targets: { driverId: DriverId; name: string; color: RouteColor }[]
  editable: boolean
  onMoveTo: (driverId: DriverId) => void
  onShift: (step: -1 | 1) => void
  onClose: () => void
}

/** The stop picked on the timeline, with the moves a mouse-free dispatcher needs: another driver, earlier, later. */
export function StopDetails({ order, route, driverName, targets, editable, onMoveTo, onShift, onClose }: Props) {
  const stop = route.trips.flatMap((t) => t.stops).find((s) => s.orderId === order?.id)
  if (!order || !stop) return null
  return (
    <section aria-label={`Stop ${order.customer}`} className="grid gap-3 rounded-lg border bg-card p-4 text-sm sm:grid-cols-[1fr_auto]">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 font-[560]">
          <RouteDot color={route.color} />
          {order.customer}
        </h2>
        <p className="mt-1 truncate text-muted-foreground">{order.geocode.status === 'not_found' ? order.addressRaw : order.geocode.address}</p>
        <p className="mt-1 text-[var(--text-2)]">
          {`${driverName} · arrives ${formatMinute(stop.eta)}, leaves ${formatMinute(stop.etd)}`}
          {order.window && ` · window ${formatWindow(order.window)}`}
          {stop.lateMinutes > 0 && <span className="text-[var(--danger-text)]">{` · ${stop.lateMinutes} min late`}</span>}
        </p>
      </div>
      <div className="flex flex-wrap items-start gap-2">
        {editable && (
          <>
            <Select
              value={null}
              onValueChange={(v) => v && onMoveTo(v as DriverId)}
              items={targets.map((t) => ({ value: t.driverId, label: t.name }))}
            >
              <SelectTrigger size="sm" aria-label="Move to driver" className="w-[160px]">
                <SelectValue placeholder="Move to driver" />
              </SelectTrigger>
              <SelectContent>
                {targets.map((t) => (
                  <SelectItem key={t.driverId} value={t.driverId}>
                    <RouteDot color={t.color} />
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => onShift(-1)}>
              <ArrowLeft aria-hidden="true" />
              Earlier
            </Button>
            <Button variant="outline" size="sm" onClick={() => onShift(1)}>
              Later
              <ArrowRight aria-hidden="true" />
            </Button>
          </>
        )}
        <Button variant="ghost" size="icon-sm" aria-label="Close stop details" onClick={onClose}>
          <X aria-hidden="true" />
        </Button>
      </div>
    </section>
  )
}
