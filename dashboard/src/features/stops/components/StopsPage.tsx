import { Link } from '@tanstack/react-router'
import { useOrders } from '@/hooks/useOrders'

// Placeholder: the stops feature replaces this with the stop list.
export function StopsPage() {
  const { data: orders } = useOrders()
  const needCheck = orders?.filter((o) => o.geocode.status === 'check' || o.geocode.status === 'not_found').length
  return (
    <section className="p-6">
      <h2 className="text-xl font-semibold">Stops</h2>
      <p className="mt-1 text-muted-foreground">{orders ? `${orders.length} stops, ${needCheck} to check` : 'Loading stops'}</p>
      <p className="mt-4 flex gap-4">
        <Link to="/stops/import" className="text-brand">Import</Link>
        <Link to="/stops/new" className="text-brand">Add stop</Link>
        <Link to="/stops/review" className="text-brand">Review addresses</Link>
      </p>
    </section>
  )
}
