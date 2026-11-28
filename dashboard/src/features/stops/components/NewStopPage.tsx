import { Link, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { StopForm } from '@/features/stops/components/StopForm'
import { useCreateOrder } from '@/features/stops/hooks/useCreateOrder'
import { emptyDraft } from '@/features/stops/stopForm'
import { stopStatusLabel, stopStatusOf } from '@/features/stops/stopList'

/** Adds one stop by hand. Its page opens next, showing where the address landed. */
export function NewStopPage() {
  const navigate = useNavigate()
  const create = useCreateOrder()
  return (
    <section className="mx-auto w-full max-w-[640px] p-4 sm:p-6">
      <h2 className="text-xl font-semibold tracking-[-0.012em]">Add a stop</h2>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">For an order that came in after the import. Big lists are faster to import.</p>
      <StopForm
        initial={emptyDraft}
        error={create.error}
        onSubmit={(input) =>
          create.mutate(input, {
            onSuccess: (order) => {
              toast.success(`Added ${order.customer}`, { description: `Address: ${stopStatusLabel[stopStatusOf(order.geocode)].toLowerCase()}.` })
              void navigate({ to: '/stops/$orderId', params: { orderId: order.id } })
            },
          })
        }
        actions={
          <>
            <Button variant="outline" nativeButton={false} render={<Link to="/stops" />}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Adding stop' : 'Add stop'}
            </Button>
          </>
        }
      />
    </section>
  )
}
