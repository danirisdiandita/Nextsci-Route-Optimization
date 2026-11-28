import { Check } from 'lucide-react'
import { Fragment } from 'react'

const steps = ['Upload', 'Match columns', 'Review'] as const

/** The three steps of a stop import, with the current one filled in. */
export function ImportSteps({ current }: { current: 0 | 1 | 2 }) {
  return (
    <ol aria-label="Import steps" className="flex flex-wrap items-center gap-2 text-xs font-[560]">
      {steps.map((label, i) => (
        <Fragment key={label}>
          {i > 0 && <li aria-hidden="true" className="h-px w-6 bg-border" />}
          <li
            aria-current={i === current ? 'step' : undefined}
            className={`flex h-7 items-center gap-1.5 rounded-full border px-3 ${
              i < current ? 'border-transparent bg-brand-soft text-brand' : i === current ? 'border-transparent bg-primary text-primary-foreground' : 'text-muted-foreground'
            }`}
          >
            {i < current ? <Check aria-hidden="true" className="size-3.5" /> : `${i + 1} ·`} {label}
          </li>
        </Fragment>
      ))}
    </ol>
  )
}
