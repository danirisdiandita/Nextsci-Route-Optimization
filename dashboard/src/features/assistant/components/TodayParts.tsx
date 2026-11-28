import type { ComponentProps, ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { useAgentBusy } from '@/features/assistant/hooks/useAgentBusy'
import { useAskAgent } from '@/features/assistant/hooks/useAskAgent'

/** The column every stage of Today sits in. */
export function StageColumn({ children }: { children: ReactNode }) {
  return <section className="mx-auto grid w-full max-w-[760px] content-start gap-4 px-4 py-6 sm:px-6">{children}</section>
}

/** An eyebrow, the stage's question or title, and something at the right such as a badge. */
export function StageHeading({ eyebrow, title, aside }: { eyebrow?: string; title: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div className="grid gap-1">
        {eyebrow && <p className="text-xs font-[560] text-brand">{eyebrow}</p>}
        <h2 className="text-xl font-semibold tracking-[-0.012em]">{title}</h2>
      </div>
      {aside}
    </div>
  )
}

export type Tone = 'success' | 'warning' | 'danger' | 'brand'

const toneColor: Record<Tone, string> = { success: 'var(--success)', warning: 'var(--warning)', danger: 'var(--danger)', brand: 'var(--color-brand)' }

/** A small rounded label tinted with a status color, such as "176 ready". */
export function ToneBadge({ tone, children }: { tone: Tone; children: ReactNode }) {
  const color = toneColor[tone]
  return (
    <span
      className="inline-flex h-6 items-center rounded-full px-2.5 text-xs font-[560]"
      style={{ color: tone === 'danger' ? 'var(--danger-text)' : color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}
    >
      {children}
    </span>
  )
}

/** A raised box on the page. `tone` tints it, such as a warning about capacity. */
export function Panel({ tone, className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  const color = tone && toneColor[tone]
  return (
    <div
      className={`rounded-xl border bg-card p-4 shadow-[var(--highlight)] ${className ?? ''}`}
      style={color ? { background: `color-mix(in srgb, ${color} 6%, var(--surface))`, borderColor: `color-mix(in srgb, ${color} 35%, transparent)` } : undefined}
    >
      {children}
    </div>
  )
}

type AskProps = Omit<ComponentProps<typeof Button>, 'onClick'> & {
  /** What the button says to the agent, such as "Send now". The conversation records it. */
  say: string
}

/**
 * A button that answers the agent. Every decision on Today goes through the conversation, so the panel
 * shows it and the agent's reply, and the page and the agent never disagree about what was decided.
 */
export function AskButton({ say, children, disabled, ...props }: AskProps) {
  const ask = useAskAgent()
  const busy = useAgentBusy()
  return (
    <Button {...props} disabled={disabled || busy} onClick={() => ask.mutate({ text: say })}>
      {children ?? say}
    </Button>
  )
}

/** The actions at the foot of a stage, with any error from the last request to the agent. */
export function StageActions({ children, note }: { children: ReactNode; note?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
      {note && <p className="mr-auto text-xs text-muted-foreground">{note}</p>}
      {children}
    </div>
  )
}
