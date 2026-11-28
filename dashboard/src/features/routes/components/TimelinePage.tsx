import { Timeline } from '@/components/Timeline'
import { useCurrentPlan } from '@/hooks/useCurrentPlan'
import { useDrivers } from '@/hooks/useDrivers'
import { useOrders } from '@/hooks/useOrders'
import { routeTimelineItems } from '@/lib/route'

// Placeholder: the routes feature replaces this with the editable timeline (design NM 08).
export function TimelinePage() {
  const { data: view } = useCurrentPlan()
  const { data: drivers } = useDrivers()
  const { data: orders } = useOrders()
  if (!view || !drivers || !orders) return null
  const customer = new Map(orders.map((o) => [o.id as string, o.customer]))
  const rows = view.routes.map((r) => ({
    id: r.id,
    color: r.color,
    label: drivers.find((d) => d.id === r.driverId)?.name.split(' ')[0] ?? 'Driver',
    items: routeTimelineItems(r, (id) => customer.get(id) ?? 'Stop'),
  }))
  const from = Math.min(...view.routes.map((r) => r.start))
  const to = Math.max(...view.routes.map((r) => r.end))
  return (
    <section className="p-6">
      <Timeline rows={rows} from={from} to={to} />
    </section>
  )
}
