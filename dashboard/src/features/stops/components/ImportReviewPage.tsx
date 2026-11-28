import { useOrders } from '@/hooks/useOrders'

// Placeholder: the stops feature replaces this with the address review (design NM 05).
export function ImportReviewPage() {
  const { data: orders } = useOrders()
  const toCheck = orders?.filter((o) => o.geocode.status === 'check' || o.geocode.status === 'not_found')
  return (
    <section className="p-6">
      <h2 className="text-xl font-semibold">Review addresses</h2>
      <p className="mt-1 text-muted-foreground">{toCheck ? `${toCheck.length} addresses to check` : 'Loading stops'}</p>
    </section>
  )
}
