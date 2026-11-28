import { Link, useNavigate } from '@tanstack/react-router'
import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import type { DepotId } from '@/api/types'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ErrorNotice } from '@/components/ErrorNotice'
import { Button } from '@/components/ui/button'
import { DepotForm } from '@/features/depots/components/DepotForm'
import { useDeleteDepot } from '@/features/depots/hooks/useDeleteDepot'
import { useDepot } from '@/features/depots/hooks/useDepot'
import { useUpdateDepot } from '@/features/depots/hooks/useUpdateDepot'
import { useVehicles } from '@/hooks/useVehicles'

/** Edits a depot, or deletes it when nothing still depends on it. */
export function DepotPage({ depotId }: { depotId: DepotId }) {
  const { data: depot, error } = useDepot(depotId)
  const { data: vehicles = [] } = useVehicles()
  const update = useUpdateDepot()
  const remove = useDeleteDepot()
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)
  if (error) {
    return (
      <section className="grid gap-4 p-6">
        <ErrorNotice error={error} />
        <Link to="/depots" className="text-sm text-brand">Back to depots</Link>
      </section>
    )
  }
  if (!depot) return null
  const vehicleCount = vehicles.filter((v) => v.depotId === depotId).length
  return (
    <>
      <DepotForm
        key={depot.id}
        heading={depot.name}
        depot={depot}
        submitLabel="Save changes"
        pending={update.isPending}
        error={update.error ?? remove.error}
        onSubmit={(patch) =>
          update.mutate({ depotId, patch }, { onSuccess: (d) => toast.success(`${d.name} saved`) })
        }
        secondary={
          <>
            <Button variant="outline" nativeButton={false} render={<Link to="/depots" />}>
              Back
            </Button>
            <Button variant="outline" className="text-destructive" onClick={() => { remove.reset(); setConfirming(true) }}>
              <Trash2 aria-hidden="true" />
              Delete
            </Button>
          </>
        }
      />
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Delete ${depot.name}?`}
        description={
          vehicleCount
            ? `${vehicleCount} vehicle${vehicleCount === 1 ? '' : 's'} still start${vehicleCount === 1 ? 's' : ''} here. Move or delete ${vehicleCount === 1 ? 'it' : 'them'} first, or the delete will stop.`
            : 'Draft plans from this depot are deleted with it. This cannot be undone.'
        }
        confirmLabel="Delete depot"
        destructive
        pending={remove.isPending}
        onConfirm={() =>
          remove.mutate(depotId, {
            onSuccess: () => {
              toast.success(`${depot.name} deleted`)
              void navigate({ to: '/depots' })
            },
            onSettled: () => setConfirming(false),
          })
        }
      />
    </>
  )
}
