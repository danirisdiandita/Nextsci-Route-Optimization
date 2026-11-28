import { Link } from '@tanstack/react-router'
import { ErrorNotice } from '@/components/ErrorNotice'
import { Button } from '@/components/ui/button'
import { useSetupSteps } from '@/features/onboarding/hooks/useSetupSteps'
import { useResetDemo } from '@/hooks/useResetDemo'

// Placeholder: the onboarding feature replaces this with the setup checklist (design NM 01).
export function SetupChecklist() {
  const { steps, doneCount } = useSetupSteps()
  const sample = useResetDemo()
  return (
    <section className="mx-auto w-full max-w-[640px] p-6">
      <h2 className="text-2xl font-semibold">Set up your workspace</h2>
      <p className="mt-1 text-muted-foreground">{`${doneCount} of ${steps.length} done`}</p>
      <ol className="mt-6 grid gap-2">
        {steps.map((s) => (
          <li key={s.key}>
            <Link to={s.to} className="text-brand">{s.title}</Link>
            {s.done && <span className="ml-2 text-muted-foreground">done</span>}
          </li>
        ))}
      </ol>
      <ErrorNotice error={sample.error} className="mt-4" />
      <Button variant="outline" className="mt-6" disabled={sample.isPending} onClick={() => sample.mutate()}>
        Try with sample data
      </Button>
    </section>
  )
}
