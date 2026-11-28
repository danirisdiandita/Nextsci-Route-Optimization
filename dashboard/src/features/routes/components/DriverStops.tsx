import { Check, CircleX, X } from 'lucide-react'
import { toast } from 'sonner'
import type { Order, OrderId, PlanId } from '@/api/types'
import { RouteDot } from '@/components/RouteDot'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import type { LiveRoute } from '@/features/routes/components/MoveStopsPanel'
import { useFailStop } from '@/features/routes/hooks/useFailStop'
import { formatMinute } from '@/lib/time'

const failReasons = ['Customer not home', 'Address not found', 'Customer refused', 'Damaged on the way']

/** One driver's stops during the live day, where a stop that could not be delivered gets marked failed. */
export function DriverStops(props: { planId: PlanId; live: LiveRoute; name: string; orders: ReadonlyMap<OrderId, Order>; onMove: () => void; onClose: () => void }) {
  const { planId, live, name, orders, onMove, onClose } = props
  const fail = useFailStop()
  const failure = new Map(live.route.trips.flatMap((t) => t.stops).map((s) => [s.orderId, s.failure]))
  return (
    <section aria-labelledby="driver-stops-title" className="grid gap-3 rounded-xl border bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 id="driver-stops-title" className="flex items-center gap-2 font-[560]">
          <RouteDot color={live.route.color} />
          {`${name}'s stops`}
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onMove}>
            Move stops
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
            <X aria-hidden="true" />
          </Button>
        </div>
      </div>
      <ol className="max-h-[440px] overflow-y-auto rounded-lg border">
        {live.progress.stops.map((s) => {
          const customer = orders.get(s.orderId)?.customer ?? 'Stop'
          return (
            <li key={s.orderId} className="flex items-center gap-3 border-t px-3 py-2 text-sm first:border-t-0">
              <span className="w-12 shrink-0 text-xs text-muted-foreground tabular-nums">{formatMinute(s.expectedEta)}</span>
              <span className={`min-w-0 flex-1 truncate ${s.status === 'done' ? 'text-muted-foreground' : ''}`}>{customer}</span>
              {s.status === 'done' && <Check aria-label="Delivered" className="size-4 text-[var(--success)]" />}
              {s.status === 'failed' && (
                <span className="flex items-center gap-1 text-xs text-[var(--danger-text)]">
                  <CircleX aria-hidden="true" className="size-3.5" />
                  {failure.get(s.orderId)?.reason ?? 'Failed'}
                </span>
              )}
              {(s.status === 'pending' || s.status === 'arrived') && (
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button variant="ghost" size="xs" disabled={fail.isPending} />}>Not delivered</DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>{`Why was ${customer} not delivered?`}</DropdownMenuLabel>
                      {failReasons.map((reason) => (
                        <DropdownMenuItem
                          key={reason}
                          onClick={() =>
                            fail.mutate({ planId, orderId: s.orderId, reason }, { onSuccess: () => toast.success(`${customer} marked failed`), onError: (e) => toast.error(e.message) })
                          }
                        >
                          {reason}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
