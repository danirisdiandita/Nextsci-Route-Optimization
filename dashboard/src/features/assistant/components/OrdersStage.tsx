import { Link } from '@tanstack/react-router'
import { FileSpreadsheet, Paperclip } from 'lucide-react'
import { useRef, useState } from 'react'
import { EmptyState } from '@/components/EmptyState'
import { ErrorNotice } from '@/components/ErrorNotice'
import { Button } from '@/components/ui/button'
import { AskButton } from '@/features/assistant/components/TodayParts'
import { useAgentBusy } from '@/features/assistant/hooks/useAgentBusy'
import { useAskAgent } from '@/features/assistant/hooks/useAskAgent'

/** Between NS 02 and NS 03: the depot and drivers are saved, and the agent waits for today's orders. */
export function OrdersStage() {
  const ask = useAskAgent()
  const busy = useAgentBusy()
  const picker = useRef<HTMLInputElement>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const attach = async (file: File | undefined) => {
    setProblem(null)
    if (!file) return
    if (file.size > 2_000_000) return setProblem(`${file.name} is larger than 2 MB. Import it from Stops instead.`)
    ask.mutate({ text: "Here are today's orders", files: [{ fileName: file.name, text: await file.text() }] })
    if (picker.current) picker.current.value = ''
  }
  return (
    <EmptyState icon={FileSpreadsheet} title="Add today's orders">
      <p className="mt-2 max-w-[480px] text-sm text-muted-foreground">
        Your depot and drivers are saved. Attach a spreadsheet with a name and an address for each stop, and the agent reads it and fixes the addresses it can.
      </p>
      <input ref={picker} type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" className="hidden" onChange={(e) => void attach(e.target.files?.[0])} />
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button disabled={busy} onClick={() => picker.current?.click()}>
          <Paperclip aria-hidden="true" />
          Attach orders file
        </Button>
        <AskButton variant="outline" say="Use the sample orders" />
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-4 text-sm">
        <Link to="/stops/import" className="text-brand hover:underline">
          Match the columns myself
        </Link>
        <Link to="/stops/new" className="text-brand hover:underline">
          Add a stop by hand
        </Link>
      </div>
      <ErrorNotice error={problem ? new Error(problem) : ask.error} className="mt-4" />
    </EmptyState>
  )
}
