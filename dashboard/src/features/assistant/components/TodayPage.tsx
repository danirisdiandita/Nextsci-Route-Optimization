import { useCurrentPlan } from '@/hooks/useCurrentPlan'
import { useWorkspace } from '@/hooks/useWorkspace'

// Placeholder: the assistant feature replaces this with the agent's home for the day (designs NS 01 to NS 08).
export function TodayPage() {
  const { data: workspace } = useWorkspace()
  const { data: view } = useCurrentPlan()
  return (
    <section className="p-6">
      <h2 className="text-xl font-semibold">Today</h2>
      <p className="mt-1 text-muted-foreground">
        {workspace ? `${workspace.counts.orders} orders, ${workspace.counts.drivers} drivers` : 'Loading'}
        {view && ` · ${view.routes.length} routes planned`}
      </p>
    </section>
  )
}
