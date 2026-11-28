import { useCurrentPlan } from '@/hooks/useCurrentPlan'
import { useSimulatedMinute } from '@/hooks/useSimulatedMinute'
import { formatMinute } from '@/lib/time'

// Placeholder: the routes feature replaces this with the live day (design NM 10).
export function LivePage() {
  const { data: view } = useCurrentPlan()
  const minute = useSimulatedMinute()
  return (
    <section className="p-6">
      <h2 className="text-xl font-semibold">Live</h2>
      <p className="mt-1 text-muted-foreground">
        {view ? `Plan ${view.plan.status}` : 'No plan'}
        {minute !== null && ` · ${formatMinute(minute)}`}
      </p>
    </section>
  )
}
