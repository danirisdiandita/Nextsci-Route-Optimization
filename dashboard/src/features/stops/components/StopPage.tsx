import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import type { OrderId } from '@/api/types'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ErrorNotice } from '@/components/ErrorNotice'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StopForm } from '@/features/stops/components/StopForm'
import { StopLocation } from '@/features/stops/components/StopLocation'
import { useDeleteOrder } from '@/features/stops/hooks/useDeleteOrder'
import { useOrder } from '@/features/stops/hooks/useOrder'
import { useUpdateOrder } from '@/features/stops/hooks/useUpdateOrder'
import { draftOf } from '@/features/stops/stopForm'
import { stopStatusLabel, stopStatusOf } from '@/features/stops/stopList'

/** One stop: edit its fields, see where its address landed, or delete it. */
export function StopPage({ orderId }: { orderId: OrderId }) {
  const navigate = useNavigate()
  const { data: order, error } = useOrder(orderId)
  const update = useUpdateOrder()
  const remove = useDeleteOrder()
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (!order) {
    return (
      <section className="mx-auto w-full max-w-[960px] p-4 sm:p-6">
        {error ? (
          <div className="grid justify-items-start gap-4">
            <ErrorNotice error={error} />
            <Button variant="outline" nativeButton={false} render={<Link to="/stops" />}>
              Back to stops
            </Button>
          </div>
        ) : (
          <Skeleton className="h-96" />
        )}
      </section>
    )
  }

  return (
    <section className="mx-auto w-full max-w-[960px] p-4 sm:p-6">
      <h2 className="mb-6 text-xl font-semibold tracking-[-0.012em]">{order.customer}</h2>
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
        <StopForm
          key={order.id}
          initial={draftOf(order)}
          error={update.error}
          onSubmit={(patch) =>
            update.mutate(
              { orderId, patch },
              {
                onSuccess: (saved) =>
                  toast.success('Stop saved', {
                    description: saved.addressRaw !== order.addressRaw ? `New address: ${stopStatusLabel[stopStatusOf(saved.geocode)].toLowerCase()}.` : undefined,
                  }),
              },
            )
          }
          actions={
            <>
              <Button type="button" variant="destructive" onClick={() => setConfirmDelete(true)}>
                Delete stop
              </Button>
              <Button type="submit" disabled={update.isPending}>
                {update.isPending ? 'Saving' : 'Save changes'}
              </Button>
            </>
          }
        />
        <StopLocation order={order} />
      </div>
      <ErrorNotice error={remove.error} className="mt-4" />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${order.customer}?`}
        description="The stop leaves the stop list and any draft plan. A stop on a route already sent to a driver cannot be deleted."
        confirmLabel="Delete stop"
        destructive
        pending={remove.isPending}
        onConfirm={() =>
          remove.mutate(orderId, {
            onSuccess: () => {
              toast.success(`Deleted ${order.customer}`)
              void navigate({ to: '/stops' })
            },
          })
        }
      />
    </section>
  )
}
