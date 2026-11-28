import { useDepots } from '@/hooks/useDepots'
import { useWorkspace } from '@/hooks/useWorkspace'
import { nextSetupStep, setupSteps } from '@/lib/setupSteps'
import { formatWindow } from '@/lib/time'

const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`

/**
 * The four setup steps, each with whether it is done and a line about what it holds, derived from the
 * workspace. `current` is the first step not done, or null when setup is done.
 */
export function useSetupSteps() {
  const workspace = useWorkspace()
  const { data: depots } = useDepots()
  const setup = workspace.data?.setup
  const counts = workspace.data?.counts
  const depot = depots?.[0]
  const summary = {
    depot: depot && `${depot.address} · ${formatWindow(depot.hours)}`,
    drivers: counts && `${plural(counts.drivers, 'driver')}, ${plural(counts.vehicles, 'vehicle')}`,
    stops: counts && plural(counts.orders, 'stop'),
    plan: counts && plural(counts.plans, 'plan'),
  }
  const steps = setupSteps.map((step) => {
    const done = setup?.[step.key] ?? false
    return { ...step, done, detail: (done && summary[step.key]) || step.body }
  })
  return {
    ...workspace,
    steps,
    doneCount: steps.filter((s) => s.done).length,
    current: setup ? nextSetupStep(setup) : null,
    /** The depot to edit from the first step, when there is one. */
    depotId: depot?.id ?? null,
  }
}
