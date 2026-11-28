import { Link } from '@tanstack/react-router'
import { ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import type { Driver, Order, OrderId, PlanView } from '@/api/types'
import { RouteDot } from '@/components/RouteDot'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { unassignedCopy } from '@/features/routes/plan'
import { useSaveChange } from '@/features/routes/hooks/useSaveChange'

/** The stops the plan could not place, each with the reason and a way to give it to a driver. */
export function UnassignedList({ view, orders, drivers }: { view: PlanView; orders: ReadonlyMap<OrderId, Order>; drivers: Driver[] }) {
  const save = useSaveChange()
  if (!view.unassigned.length) return null
  const nameOf = (id: Driver['id']) => drivers.find((d) => d.id === id)?.name.split(' ')[0] ?? 'Driver'
  return (
    <section aria-labelledby="unassigned-title" className="border-t px-4 py-3 lg:px-6">
      <h2 id="unassigned-title" className="text-sm font-[560]">{`Not on a route (${view.unassigned.length})`}</h2>
      <ul className="mt-2 grid gap-1">
        {view.unassigned.map((u) => {
          const order = orders.get(u.orderId)
          const name = order?.customer ?? 'Stop'
          return (
            <li key={u.orderId} className="flex items-center justify-between gap-3 py-1 text-sm">
              <span className="min-w-0">
                <span className="block truncate font-[560]">{name}</span>
                <span className="block text-xs text-[var(--danger-text)]">{unassignedCopy[u.reason]}</span>
              </span>
              {u.reason === 'no_location' ? (
                <Button variant="outline" size="xs" nativeButton={false} render={<Link to="/stops/$orderId" params={{ orderId: u.orderId }} />}>
                  Fix address
                </Button>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button variant="outline" size="xs" disabled={save.isPending} />}>
                    Give to
                    <ChevronDown aria-hidden="true" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuGroup>
                    <DropdownMenuLabel>{`Give ${name} to`}</DropdownMenuLabel>
                    {view.routes.map((r) => (
                      <DropdownMenuItem
                        key={r.id}
                        onClick={() =>
                          save.mutate(
                            { planId: view.plan.id, summary: `Gave ${name} to ${nameOf(r.driverId)}`, diff: [{ kind: 'assign_stop', orderId: u.orderId, toDriverId: r.driverId }] },
                            { onSuccess: () => toast.success(`Gave ${name} to ${nameOf(r.driverId)}`), onError: (e) => toast.error(e.message) },
                          )
                        }
                      >
                        <RouteDot color={r.color} />
                        {nameOf(r.driverId)}
                      </DropdownMenuItem>
                    ))}
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
