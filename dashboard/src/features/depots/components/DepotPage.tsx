import type { DepotId } from '@/api/types'
import { ErrorNotice } from '@/components/ErrorNotice'
import { useDepot } from '@/features/depots/hooks/useDepot'

// Placeholder: the depots feature replaces this with the depot edit form.
export function DepotPage({ depotId }: { depotId: DepotId }) {
  const { data: depot, error } = useDepot(depotId)
  return (
    <section className="p-6">
      <h2 className="text-xl font-semibold">{depot?.name ?? 'Depot'}</h2>
      <p className="mt-1 text-muted-foreground">{depot?.address}</p>
      <ErrorNotice error={error} className="mt-4" />
    </section>
  )
}
