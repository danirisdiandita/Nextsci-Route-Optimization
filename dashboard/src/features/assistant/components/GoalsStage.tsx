import { Link } from '@tanstack/react-router'
import { Sparkles, TriangleAlert } from 'lucide-react'
import type { PlanGoal } from '@/api/types'
import { planGoals } from '@/api/types'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { goalLabels, type TodayStage } from '@/features/assistant/api'
import { AskButton, Panel, StageActions, StageColumn, StageHeading } from '@/features/assistant/components/TodayParts'
import { useAgentBusy } from '@/features/assistant/hooks/useAgentBusy'
import { useAskAgent } from '@/features/assistant/hooks/useAskAgent'
import { formatMinute } from '@/lib/time'

const capitalized = (text: string) => text[0].toUpperCase() + text.slice(1)

/**
 * Design NS 04: before planning, what the plan aims for and whether the boxes fit. Picking an option tells
 * the agent, so the choice is in the conversation and the plan uses it.
 */
export function GoalsStage({ stage }: { stage: Extract<TodayStage, { kind: 'goals' }> }) {
  const ask = useAskAgent()
  const busy = useAgentBusy()
  const { capacity, goal, reloads, review, backBy } = stage
  return (
    <StageColumn>
      <StageHeading eyebrow="Before planning" title="What should today's plan aim for?" />
      <Panel>
        <h3 className="text-sm font-[560]">Goals</h3>
        <ol className="mt-3 grid gap-2 text-sm text-[var(--text-2)]">
          <li className="flex justify-between gap-4">
            <span>1. Every order delivered inside its window</span>
            <span className="text-xs text-muted-foreground">must</span>
          </li>
          <li className="flex justify-between gap-4">
            <span>{`2. Drivers back at the depot by ${formatMinute(backBy)}`}</span>
            <span className="text-xs text-muted-foreground">must</span>
          </li>
        </ol>
        <p id="goal-label" className="mt-4 text-xs text-muted-foreground">
          3. Then aim for
        </p>
        <RadioGroup aria-labelledby="goal-label" value={goal} disabled={busy} onValueChange={(v) => ask.mutate({ text: `Aim for ${goalLabels[v as PlanGoal]}` })} className="mt-2">
          {planGoals.map((g) => (
            <label key={g} className="flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm has-data-checked:border-ring">
              <RadioGroupItem value={g} />
              {capitalized(goalLabels[g])}
              <span className="ml-auto text-xs text-muted-foreground">prefer</span>
            </label>
          ))}
        </RadioGroup>
      </Panel>
      {capacity.fits ? (
        <Panel tone="success">
          <p className="text-sm text-[var(--text-2)]">{`Everything fits in one trip: ${capacity.boxes} boxes against ${capacity.perTrip} of space.`}</p>
        </Panel>
      ) : (
        <Panel tone="warning">
          <h3 className="flex items-center gap-2 text-sm font-[560]">
            <TriangleAlert aria-hidden="true" className="size-4 text-[var(--warning)]" />
            Your boxes don't fit in one trip
          </h3>
          <p id="capacity-label" className="mt-2 text-sm text-[var(--text-2)]">
            {`The orders need ${capacity.boxes} boxes, and your ${capacity.vehicles} ${capacity.vehicleNoun} carry ${capacity.perTrip} per trip. Pick how to handle it:`}
          </p>
          <RadioGroup
            aria-labelledby="capacity-label"
            value={reloads ? 'reload' : 'one'}
            disabled={busy}
            onValueChange={(v) => ask.mutate({ text: v === 'reload' ? 'Drivers return to reload' : 'One trip per driver' })}
            className="mt-3"
          >
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border bg-card px-3 py-2 text-sm has-data-checked:border-ring">
              <RadioGroupItem value="reload" />
              {`Drivers return to reload (about ${capacity.tripsEach} trips each)`}
              <span className="ml-auto text-xs text-muted-foreground">recommended</span>
            </label>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border bg-card px-3 py-2 text-sm has-data-checked:border-ring">
              <RadioGroupItem value="one" />
              One trip per driver. Stops that don't fit stay unassigned
            </label>
          </RadioGroup>
          <Link to="/stops" className="mt-3 inline-block text-sm text-brand hover:underline">
            My box counts are wrong. Let me fix them
          </Link>
        </Panel>
      )}
      <StageActions>
        <AskButton say={`Plan ${review.total} orders`}>
          <Sparkles aria-hidden="true" />
          {`Plan ${review.total} orders`}
        </AskButton>
      </StageActions>
    </StageColumn>
  )
}
