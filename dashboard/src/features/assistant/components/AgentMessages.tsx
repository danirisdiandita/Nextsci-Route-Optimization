import { Check, CircleHelp, FileText } from 'lucide-react'
import type { AgentMessage } from '@/api/types'
import { isIncidentMessage } from '@/features/assistant/api'
import { messageBlocks, type MessageBlock } from '@/features/assistant/messageText'
import { formatMinute } from '@/lib/time'

/** One block of an agent message: a paragraph, a list, a checklist, or a titled card. */
export function MessageBlockView({ block }: { block: MessageBlock }) {
  switch (block.kind) {
    case 'paragraph':
      return <p className="whitespace-pre-line">{block.text}</p>
    case 'list':
      return (
        <ul className="grid list-disc gap-1 pl-4 marker:text-muted-foreground">
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )
    case 'checks':
      return (
        <ul className="grid gap-1 rounded-lg border bg-card px-3 py-2 text-xs">
          {block.items.map((item) => (
            <li key={item.text} className={`flex gap-2 ${item.done ? 'text-[var(--success)]' : 'text-[var(--warning)]'}`}>
              {item.done ? <Check aria-label="Done" className="mt-0.5 size-3.5 shrink-0" /> : <CircleHelp aria-label="Assumed" className="mt-0.5 size-3.5 shrink-0" />}
              <span>{item.text}</span>
            </li>
          ))}
        </ul>
      )
    case 'card':
      return (
        <div className="grid gap-1.5 rounded-lg border bg-card px-3 py-2.5 shadow-[var(--highlight)]">
          <p className="font-[560] text-foreground">{block.title}</p>
          {block.body && (
            <div className="text-xs text-[var(--text-2)]">
              <MessageBlockView block={block.body} />
            </div>
          )}
        </div>
      )
  }
}

function AgentText({ text }: { text: string }) {
  return (
    <div className="grid gap-2">
      {messageBlocks(text).map((block, i) => (
        <MessageBlockView key={i} block={block} />
      ))}
    </div>
  )
}

type Run = { kind: 'log'; messages: AgentMessage[] } | { kind: 'chat'; message: AgentMessage }

/** Consecutive log lines read as one "Today's log" section. */
function runsOf(messages: AgentMessage[]): Run[] {
  const runs: Run[] = []
  for (const m of messages) {
    const last = runs.at(-1)
    if (m.kind === 'event' && last?.kind === 'log') last.messages.push(m)
    else if (m.kind === 'event') runs.push({ kind: 'log', messages: [m] })
    else runs.push({ kind: 'chat', message: m })
  }
  return runs
}

/** The conversation, oldest first: the dispatcher's messages on the right, the agent's replies and log on the left. */
export function AgentMessages({ messages }: { messages: AgentMessage[] }) {
  return (
    <ol className="grid gap-4 text-sm">
      {runsOf(messages).map((run) =>
        run.kind === 'log' ? (
          <li key={run.messages[0].id} className="grid gap-2">
            <p className="text-xs font-[560] text-muted-foreground">Today's log</p>
            <ol className="grid gap-2">
              {run.messages.map((m) => (
                <li key={m.id} className="grid grid-cols-[40px_1fr] gap-2 text-[var(--text-2)]">
                  <span className={`text-xs tabular-nums ${isIncidentMessage(m) ? 'text-[var(--danger-text)]' : 'text-muted-foreground'}`}>
                    {m.at === null ? '' : formatMinute(m.at)}
                  </span>
                  <span>{m.text}</span>
                </li>
              ))}
            </ol>
          </li>
        ) : run.message.role === 'user' ? (
          <li key={run.message.id} className="ml-10 grid justify-items-end gap-1.5">
            {run.message.text && <p className="rounded-lg bg-muted px-3 py-2 whitespace-pre-line text-foreground">{run.message.text}</p>}
            {run.message.attachments.map((name) => (
              <span key={name} className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs text-muted-foreground">
                <FileText aria-hidden="true" className="size-3.5" />
                {name}
              </span>
            ))}
          </li>
        ) : (
          <li key={run.message.id} className="text-[var(--text-2)]">
            <AgentText text={run.message.text} />
          </li>
        ),
      )}
    </ol>
  )
}
