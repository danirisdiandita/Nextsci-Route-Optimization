import type { OrderId } from '@/api/types'
import { ErrorNotice } from '@/components/ErrorNotice'
import { useOrder } from '@/features/stops/hooks/useOrder'

// Placeholder: the stops feature replaces this with the stop edit form.
export function StopPage({ orderId }: { orderId: OrderId }) {
  const { data: order, error } = useOrder(orderId)
  return (
    <section className="p-6">
      <h2 className="text-xl font-semibold">{order?.customer ?? 'Stop'}</h2>
      <p className="mt-1 text-muted-foreground">{order?.addressRaw}</p>
      <ErrorNotice error={error} className="mt-4" />
    </section>
  )
}
