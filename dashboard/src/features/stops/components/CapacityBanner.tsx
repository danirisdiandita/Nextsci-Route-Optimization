import { Link } from '@tanstack/react-router'
import { CircleCheck, TriangleAlert } from 'lucide-react'
import type { Order } from '@/api/types'
import { fleetLoad } from '@/features/stops/stopList'
import { useDrivers } from '@/hooks/useDrivers'
import { useVehicles } from '@/hooks/useVehicles'

/** Whether one trip per active driver carries every box, and what to do when it does not. */
export function CapacityBanner({ orders }: { orders: Order[] }) {
  const { data: drivers } = useDrivers()
  const { data: vehicles } = useVehicles()
  if (!drivers || !vehicles) return null
  const load = fleetLoad(orders, drivers, vehicles)
  const over = load.demand > load.perTrip
  const tone = over ? 'var(--warning)' : 'var(--success)'
  const Icon = over ? TriangleAlert : CircleCheck
  return (
    <div
      role="status"
      className="flex gap-3 rounded-lg border px-4 py-3 text-sm"
      style={{ background: `color-mix(in srgb, ${tone} 10%, transparent)`, borderColor: `color-mix(in srgb, ${tone} 30%, transparent)` }}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" style={{ color: tone }} />
      <div className="grid gap-0.5">
        <p className="font-[560]">{`Load is ${load.demand} boxes. Your drivers carry ${load.perTrip} per trip.`}</p>
        <p className="text-[var(--text-2)]">
          {load.drivers === 0 ? (
            <>
              No active driver has a vehicle yet. <Link to="/drivers" className="text-brand">Add drivers</Link> before you plan.
            </>
          ) : over ? (
            'Turn on depot reloads in plan settings, or some stops will stay unassigned.'
          ) : (
            'One trip each covers the load.'
          )}
        </p>
      </div>
    </div>
  )
}
