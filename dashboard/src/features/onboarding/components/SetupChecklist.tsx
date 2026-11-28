import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowRight, Check, Eraser, FlaskConical } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ErrorNotice } from '@/components/ErrorNotice'
import { Button } from '@/components/ui/button'
import { useSetupSteps } from '@/features/onboarding/hooks/useSetupSteps'
import { useClearWorkspace } from '@/hooks/useClearWorkspace'
import { useResetDemo } from '@/hooks/useResetDemo'

type Confirm = 'sample' | 'empty' | null

/** The setup checklist that a new workspace opens on (design NM 01). */
export function SetupChecklist() {
  const { steps, doneCount, current, depotId, data: workspace, error } = useSetupSteps()
  const sample = useResetDemo()
  const clear = useClearWorkspace()
  const navigate = useNavigate()
  const [confirm, setConfirm] = useState<Confirm>(null)
  if (!workspace) return <ErrorNotice error={error} className="m-6" />
  const hasData = Object.values(workspace.counts).some((n) => n > 0)
  const loadSample = () =>
    sample.mutate(undefined, {
      onSuccess: () => {
        setConfirm(null)
        toast.success('Sample data loaded')
        void navigate({ to: '/today' })
      },
      onError: () => setConfirm(null),
    })
  const startEmpty = () =>
    clear.mutate(undefined, {
      onSuccess: () => {
        setConfirm(null)
        toast.success('Workspace emptied')
      },
      onError: () => setConfirm(null),
    })
  const editPath = { depot: depotId ? `/depots/${depotId}` : '/depots', drivers: '/drivers', stops: '/stops', plan: '/routes' } as const
  return (
    <section className="mx-auto w-full max-w-[640px] px-4 py-10 sm:px-6 sm:py-14">
      <h2 className="text-2xl font-semibold tracking-[-0.016em]">{current ? 'Set up your workspace' : 'Your workspace is set up'}</h2>
      <p className="mt-2 text-muted-foreground">
        {current
          ? 'Four steps to your first planned day. You can come back to any step later.'
          : 'Every step is done. Plan each day from Routes, or ask the agent to change a plan.'}
      </p>
      <div className="mt-6 flex items-center gap-3">
        <div
          role="progressbar"
          aria-label="Setup progress"
          aria-valuemin={0}
          aria-valuemax={steps.length}
          aria-valuenow={doneCount}
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
        >
          <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
        </div>
        <span className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">{`${doneCount} of ${steps.length} done`}</span>
      </div>
      <ol className="mt-4 overflow-hidden rounded-lg border bg-card">
        {steps.map((step, i) => {
          const isCurrent = current?.key === step.key
          return (
            <li
              key={step.key}
              aria-current={isCurrent ? 'step' : undefined}
              className={`flex items-center gap-4 border-b px-4 py-3.5 last:border-b-0 ${isCurrent ? 'bg-inset' : ''}`}
            >
              <StepMark index={i + 1} done={step.done} current={isCurrent} />
              <div className="min-w-0 flex-1">
                <Link to={step.to} className="text-sm font-[560] hover:underline">
                  {step.title}
                </Link>
                <p className="truncate text-xs text-muted-foreground">{step.detail}</p>
              </div>
              {step.done ? (
                <Link to={editPath[step.key]} className="text-sm font-[560] text-brand hover:underline" aria-label={`Edit: ${step.title}`}>
                  Edit
                </Link>
              ) : (
                isCurrent && (
                  <Button size="sm" nativeButton={false} render={<Link to={step.to} />}>
                    {step.action}
                  </Button>
                )
              )}
            </li>
          )
        })}
      </ol>
      {!current && (
        <Button className="mt-6" nativeButton={false} render={<Link to="/today" />}>
          Open today
          <ArrowRight aria-hidden="true" />
        </Button>
      )}
      <ErrorNotice error={sample.error ?? clear.error} className="mt-4" />
      <div className="mt-6 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" className="rounded-full" onClick={() => (hasData ? setConfirm('sample') : loadSample())} disabled={sample.isPending}>
          <FlaskConical aria-hidden="true" />
          Try with sample data
        </Button>
        {hasData && (
          <Button variant="outline" size="sm" className="rounded-full" onClick={() => setConfirm('empty')}>
            <Eraser aria-hidden="true" />
            Start empty
          </Button>
        )}
      </div>
      <ConfirmDialog
        open={confirm === 'sample'}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="Replace your workspace with the sample?"
        description="This replaces everything in this browser with the sample kitchen in Yogyakarta: one depot, ten drivers, 180 stops, and a draft plan for today."
        confirmLabel="Load sample data"
        destructive
        pending={sample.isPending}
        onConfirm={loadSample}
      />
      <ConfirmDialog
        open={confirm === 'empty'}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="Start with an empty workspace?"
        description="This deletes every depot, driver, stop, and plan in this browser, so setup starts from the first step."
        confirmLabel="Delete everything"
        destructive
        pending={clear.isPending}
        onConfirm={startEmpty}
      />
    </section>
  )
}

function StepMark({ index, done, current }: { index: number; done: boolean; current: boolean }) {
  if (done) {
    return (
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--success)] text-[var(--surface)]">
        <Check aria-hidden="true" className="size-4" strokeWidth={2.5} />
        <span className="sr-only">Done</span>
      </span>
    )
  }
  return (
    <span
      className={`flex size-7 shrink-0 items-center justify-center rounded-full border text-xs tabular-nums ${current ? 'border-brand text-brand' : 'text-muted-foreground'}`}
    >
      {index}
    </span>
  )
}
