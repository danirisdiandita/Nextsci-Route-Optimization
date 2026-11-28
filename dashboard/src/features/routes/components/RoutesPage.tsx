import { Link } from '@tanstack/react-router'
import { Route } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { RouteMap } from '@/components/RouteMap'
import { Button } from '@/components/ui/button'
import { useCurrentPlan } from '@/hooks/useCurrentPlan'
import { useDepots } from '@/hooks/useDepots'
import { useOrders } from '@/hooks/useOrders'
import { routePaths } from '@/lib/route'

// Placeholder: the routes feature replaces this with the planned routes (design NM 07).
export function RoutesPage() {
  const { data: view, isPending } = useCurrentPlan()
  const { data: depots } = useDepots()
  const { data: orders } = useOrders()
  if (isPending) return null
  if (!view)
    return (
      <EmptyState icon={Route} title="No routes yet">
        <p className="mt-2 max-w-[440px] text-balance text-muted-foreground">Plan a day to see each driver's route here.</p>
        <Button className="mt-6" nativeButton={false} render={<Link to="/routes/new" />}>
          Plan routes
        </Button>
      </EmptyState>
    )
  const depot = depots?.find((d) => d.id === view.plan.depotId)
  const byId = new Map(orders?.map((o) => [o.id, o]))
  return (
    <section className="flex flex-1 flex-col">
      <p className="border-b px-6 py-3 text-muted-foreground">{`${view.routes.length} routes, ${view.unassigned.length} unassigned`}</p>
      {depot && (
        <RouteMap
          className="min-h-[480px] flex-1"
          label={`Map of ${view.routes.length} routes from ${depot.name}`}
          depot={depot.location}
          routes={view.routes.map((r) => ({ id: r.id, color: r.color, paths: routePaths(r, byId, depot.location) }))}
        />
      )}
    </section>
  )
}
