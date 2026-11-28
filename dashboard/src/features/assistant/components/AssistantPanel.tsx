import { RotateCcw, Sparkles, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ErrorNotice } from '@/components/ErrorNotice'
import { Button } from '@/components/ui/button'
import { suggestionsFor, type AgentFile } from '@/features/assistant/api'
import { AgentMessages } from '@/features/assistant/components/AgentMessages'
import { Composer } from '@/features/assistant/components/Composer'
import { useAgentBusy } from '@/features/assistant/hooks/useAgentBusy'
import { useAgentMessages } from '@/features/assistant/hooks/useAgentMessages'
import { useAskAgent } from '@/features/assistant/hooks/useAskAgent'
import { useClearAgentMessages } from '@/features/assistant/hooks/useClearAgentMessages'
import { useToday } from '@/features/assistant/hooks/useToday'
import { useAgentPanel } from '@/hooks/useAgentPanel'

/** The dispatch agent beside the page: the conversation, today's log, and a box to write in. */
export function AssistantPanel() {
  const { setOpen } = useAgentPanel()
  const { data: messages } = useAgentMessages()
  const { data: today } = useToday()
  const ask = useAskAgent()
  const busy = useAgentBusy()
  const clear = useClearAgentMessages()
  const [draft, setDraft] = useState('')
  const [files, setFiles] = useState<AgentFile[]>([])
  const [confirmClear, setConfirmClear] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  const last = messages?.at(-1)
  // The newest reply's suggestions, or the stage's when the conversation has none yet.
  const suggestions = busy ? [] : last ? (last.role === 'agent' ? last.suggestions : []) : today ? suggestionsFor(today.stage) : []

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [messages?.length, busy])

  const send = (text: string, attached: AgentFile[] = []) =>
    ask.mutate(
      { text, files: attached },
      {
        onSuccess: () => {
          setDraft('')
          setFiles([])
        },
      },
    )

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <Sparkles aria-hidden="true" className="size-4 text-brand" />
        <h2 className="text-sm font-[560]">Dispatch agent</h2>
        <Button
          variant="ghost"
          size="icon-sm"
          className="ml-auto"
          aria-label="Clear the conversation"
          disabled={!messages?.length || busy}
          onClick={() => setConfirmClear(true)}
        >
          <RotateCcw />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Close the agent" onClick={() => setOpen(false)}>
          <X />
        </Button>
      </header>
      <div className="flex-1 overflow-y-auto p-4">
        {messages?.length === 0 && (
          <p className="text-sm text-[var(--text-2)]">
            I'm your dispatch agent. Tell me about your operation, or ask me to change today's plan. Nothing changes until you say so.
          </p>
        )}
        {messages && <AgentMessages messages={messages} />}
        {busy && (
          <p role="status" className="mt-4 text-sm text-muted-foreground motion-safe:animate-pulse">
            Working…
          </p>
        )}
        {suggestions.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <Button key={s} variant="outline" size="sm" className="rounded-full" onClick={() => send(s)}>
                {s}
              </Button>
            ))}
          </div>
        )}
        <div ref={end} />
      </div>
      <div className="grid gap-2 border-t p-3">
        <ErrorNotice error={ask.error} />
        <Composer
          variant="panel"
          value={draft}
          onChange={setDraft}
          files={files}
          onFilesChange={setFiles}
          onSubmit={() => send(draft, files)}
          busy={busy}
          placeholder="Ask or tell the agent what to change..."
        />
      </div>
      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Clear the conversation?"
        description="The agent forgets what you told it, including a setup draft you have not confirmed. Your depots, drivers, stops, and plans stay."
        confirmLabel="Clear"
        destructive
        pending={clear.isPending}
        onConfirm={() => clear.mutate(undefined, { onSuccess: () => setConfirmClear(false) })}
      />
    </div>
  )
}
