import { ArrowRight, ArrowUp, FileText, Paperclip, X } from 'lucide-react'
import { useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import type { AgentFile } from '@/features/assistant/api'

type Props = {
  /** `hero`: the large box on an empty Today. `panel`: the box at the foot of the agent panel. */
  variant: 'hero' | 'panel'
  value: string
  onChange: (value: string) => void
  files: AgentFile[]
  onFilesChange: (files: AgentFile[]) => void
  onSubmit: () => void
  busy: boolean
  placeholder: string
  /** Shown after the attach button, such as a hint. */
  extra?: ReactNode
}

/**
 * Where the dispatcher writes to the agent and attaches an orders file. Enter sends, Shift+Enter starts a
 * new line. A file is read as text when it is picked, and goes with the next message.
 */
export function Composer({ variant, value, onChange, files, onFilesChange, onSubmit, busy, placeholder, extra }: Props) {
  const picker = useRef<HTMLInputElement>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const canSend = !busy && (value.trim().length > 0 || files.length > 0)
  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    if (canSend) onSubmit()
  }
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) submit(e)
  }
  const attach = async (list: FileList | null) => {
    setFileError(null)
    const file = list?.[0]
    if (!file) return
    if (file.size > 2_000_000) return setFileError(`${file.name} is larger than 2 MB. Split it, or import it from Stops.`)
    const text = await file.text()
    onFilesChange([...files.filter((f) => f.fileName !== file.name), { fileName: file.name, text }])
    if (picker.current) picker.current.value = ''
  }
  const hero = variant === 'hero'
  return (
    <form
      onSubmit={submit}
      className={
        hero
          ? 'w-full rounded-xl border bg-card p-3 text-left shadow-[var(--highlight)] focus-within:border-[var(--border-strong)]'
          : 'rounded-lg border bg-inset p-2 focus-within:border-ring'
      }
    >
      <textarea
        id={hero ? 'agent-hero-composer' : 'agent-composer'}
        aria-label="Message to the agent"
        rows={hero ? 3 : 2}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        className="field-sizing-content max-h-48 min-h-10 w-full resize-none bg-transparent px-1 text-sm text-foreground outline-none placeholder:text-muted-foreground"
      />
      <input ref={picker} type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" className="hidden" onChange={(e) => void attach(e.target.files)} />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {files.map((f) => (
          <span key={f.fileName} className="inline-flex h-7 items-center gap-1.5 rounded-md bg-muted px-2 text-xs text-[var(--text-2)]">
            <FileText aria-hidden="true" className="size-3.5 text-muted-foreground" />
            {f.fileName}
            <button
              type="button"
              aria-label={`Remove ${f.fileName}`}
              className="rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
              onClick={() => onFilesChange(files.filter((x) => x !== f))}
            >
              <X aria-hidden="true" className="size-3" />
            </button>
          </span>
        ))}
        {hero ? (
          <Button type="button" variant="outline" size="sm" onClick={() => picker.current?.click()}>
            <Paperclip aria-hidden="true" />
            Attach orders
          </Button>
        ) : (
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Attach an orders file" onClick={() => picker.current?.click()}>
            <Paperclip />
          </Button>
        )}
        {extra}
        {hero ? (
          <Button type="submit" size="sm" className="ml-auto" disabled={!canSend}>
            {busy ? 'Setting up…' : 'Set it up'}
            <ArrowRight aria-hidden="true" />
          </Button>
        ) : (
          <Button type="submit" size="icon-sm" className="ml-auto" disabled={!canSend}>
            <ArrowUp aria-hidden="true" />
            <span className="sr-only">Send</span>
          </Button>
        )}
      </div>
      {fileError && <p className="mt-2 text-xs text-[var(--danger-text)]">{fileError}</p>}
    </form>
  )
}
