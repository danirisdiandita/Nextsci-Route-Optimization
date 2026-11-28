import { Link, useNavigate } from '@tanstack/react-router'
import { FileSpreadsheet, Upload } from 'lucide-react'
import { useRef, useState, type DragEvent } from 'react'
import { ErrorNotice } from '@/components/ErrorNotice'
import { Button } from '@/components/ui/button'
import { ImportSteps } from '@/features/stops/components/ImportSteps'
import { useCreateOrderImport } from '@/features/stops/hooks/useCreateOrderImport'
import { useSampleOrdersFile } from '@/hooks/useSampleOrdersFile'

const readable = /\.(csv|tsv|txt)$/i

/** Step 1 of the import: pick a CSV file, or try the sample. The file is read in the browser. */
export function ImportPage() {
  const navigate = useNavigate()
  const create = useCreateOrderImport()
  const sample = useSampleOrdersFile()
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [fileError, setFileError] = useState<Error | null>(null)

  const start = (fileName: string, text: string) =>
    create.mutate({ fileName, text }, { onSuccess: (orderImport) => navigate({ to: '/stops/import/$importId', params: { importId: orderImport.id } }) })

  const read = async (file: File | undefined) => {
    if (!file) return
    setFileError(null)
    if (!readable.test(file.name)) {
      setFileError(new Error(`${file.name} is not a CSV file. In your spreadsheet app, save the sheet as CSV and upload that.`))
      return
    }
    start(file.name, await file.text())
  }

  const drop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    void read(e.dataTransfer.files[0])
  }

  return (
    <section className="mx-auto flex w-full max-w-[880px] flex-1 flex-col gap-6 p-4 sm:p-6">
      <ImportSteps current={0} />
      <div>
        <h2 className="text-xl font-semibold tracking-[-0.012em]">Import today's stops</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload the spreadsheet you already keep. Next you match its columns, then check the addresses the map could not place.
        </p>
      </div>
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={drop}
        className={`flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center transition-colors ${dragging ? 'border-ring bg-brand-soft' : 'bg-card'}`}
      >
        <span className="flex size-10 items-center justify-center rounded-lg border bg-background">
          <Upload aria-hidden="true" className="size-5 text-muted-foreground" />
        </span>
        <p className="text-sm font-[560]">Drop a CSV file here</p>
        <p className="text-xs text-muted-foreground">One row per stop under a header row. Comma, semicolon, or tab separated.</p>
        <input
          ref={input}
          type="file"
          accept=".csv,.tsv,.txt,text/csv"
          className="sr-only"
          aria-label="CSV file"
          onChange={(e) => void read(e.target.files?.[0])}
        />
        <Button variant="secondary" disabled={create.isPending} onClick={() => input.current?.click()}>
          {create.isPending ? 'Reading file' : 'Choose a file'}
        </Button>
      </div>
      <ErrorNotice error={fileError ?? create.error ?? sample.error} />
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3">
        <span className="flex min-w-0 items-center gap-2 text-sm">
          <FileSpreadsheet aria-hidden="true" className="size-4 shrink-0 text-[var(--success)]" />
          <span>
            No file at hand? Try the sample orders{sample.data && <span className="text-muted-foreground">, {sample.data.fileName}</span>}.
          </span>
        </span>
        <Button variant="outline" size="sm" disabled={!sample.data || create.isPending} onClick={() => sample.data && start(sample.data.fileName, sample.data.text)}>
          Use sample file
        </Button>
      </div>
      <div className="mt-auto flex justify-between gap-3 pt-4">
        <Button variant="outline" nativeButton={false} render={<Link to="/stops" />}>
          Back
        </Button>
        <Button variant="ghost" nativeButton={false} render={<Link to="/stops/new" />}>
          Add one stop by hand
        </Button>
      </div>
    </section>
  )
}
