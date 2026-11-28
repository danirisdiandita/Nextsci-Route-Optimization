import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { ErrorNotice } from '@/components/ErrorNotice'
import { Button } from '@/components/ui/button'
import type { AgentFile } from '@/features/assistant/api'
import { Composer } from '@/features/assistant/components/Composer'
import { useAgentBusy } from '@/features/assistant/hooks/useAgentBusy'
import { useAskAgent } from '@/features/assistant/hooks/useAskAgent'
import { useSampleOrdersFile } from '@/hooks/useSampleOrdersFile'

const SAMPLE =
  "We're a food delivery kitchen at Jl. Layur VII, Yogyakarta. 10 drivers on motorbikes, 08:00 to 16:00 with a half-hour lunch around noon. Each bike carries 10 boxes."

/** Design NS 01: an empty workspace. The dispatcher describes the operation, and the agent drafts the setup. */
export function DescribeStage() {
  const ask = useAskAgent()
  const busy = useAgentBusy()
  const sample = useSampleOrdersFile()
  const [text, setText] = useState('')
  const [files, setFiles] = useState<AgentFile[]>([])
  const trySample = () => {
    setText(SAMPLE)
    if (sample.data) setFiles([{ fileName: sample.data.fileName, text: sample.data.text }])
    document.getElementById('agent-hero-composer')?.focus()
  }
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 text-center">
      <img src="/favicon.svg" alt="" className="size-10" />
      <h2 className="mt-6 text-2xl font-semibold tracking-[-0.02em]">Let's plan your first day</h2>
      <p className="mt-3 max-w-[560px] text-sm text-muted-foreground">
        Describe your operation in your own words. The agent sets up the depot, drivers, and shifts, and shows you what it understood.
      </p>
      <div className="mt-8 w-full max-w-[560px]">
        <Composer
          variant="hero"
          value={text}
          onChange={setText}
          files={files}
          onFilesChange={setFiles}
          busy={busy}
          onSubmit={() => ask.mutate({ text, files })}
          placeholder="Where do your drivers load, how many are there, when do they work, and what do they carry?"
        />
        <ErrorNotice error={ask.error} className="mt-3 text-left" />
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Button variant="outline" size="sm" className="rounded-full" onClick={trySample} disabled={!sample.data}>
          Try with sample data
        </Button>
        <Button variant="outline" size="sm" className="rounded-full" nativeButton={false} render={<Link to="/drivers" />}>
          Import my drivers from CSV
        </Button>
        <Button variant="outline" size="sm" className="rounded-full" nativeButton={false} render={<Link to="/onboarding" />}>
          Set up by hand instead
        </Button>
      </div>
    </div>
  )
}
