import { Sparkles, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { ErrorNotice } from '@/components/ErrorNotice'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useAgentMessages } from '@/features/assistant/hooks/useAgentMessages'
import { useCreateAgentMessage } from '@/features/assistant/hooks/useCreateAgentMessage'
import { useAgentPanel } from '@/hooks/useAgentPanel'

// Placeholder: the assistant feature replaces the message list and composer, and src/api/mock/agent.ts
// answers. The shell gives this panel the full height beside the main content.
export function AssistantPanel() {
  const { setOpen } = useAgentPanel()
  const { data: messages } = useAgentMessages()
  const send = useCreateAgentMessage()
  const [draft, setDraft] = useState('')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    send.mutate({ role: 'user', kind: 'chat', text: draft }, { onSuccess: () => setDraft('') })
  }
  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <Sparkles aria-hidden="true" className="size-4 text-brand" />
        <h2 className="text-sm font-[560]">Dispatch agent</h2>
        <Button variant="ghost" size="icon-sm" className="ml-auto" aria-label="Close the agent" onClick={() => setOpen(false)}>
          <X />
        </Button>
      </header>
      <ol className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
        {messages?.map((m) => (
          <li key={m.id} className={m.role === 'user' ? 'ml-8 rounded-lg bg-muted px-3 py-2' : 'text-[var(--text-2)]'}>
            {m.text}
          </li>
        ))}
      </ol>
      <form onSubmit={submit} className="grid gap-2 border-t p-3">
        <ErrorNotice error={send.error} />
        <Textarea aria-label="Message to the agent" placeholder="Ask or tell the agent what to change..." value={draft} onChange={(e) => setDraft(e.target.value)} />
        <Button type="submit" size="sm" className="justify-self-end" disabled={send.isPending}>
          Send
        </Button>
      </form>
    </div>
  )
}
