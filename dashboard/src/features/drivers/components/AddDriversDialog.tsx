import { FileUp } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { ErrorNotice } from '@/components/ErrorNotice'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useCreateFleetDrivers } from '@/features/drivers/hooks/useCreateFleetDrivers'
import { formatBreak, parseDriverLines, vehicleKindLabel, type DriverDefaults } from '@/lib/driverDefaults'
import { formatWindow } from '@/lib/time'

type Props = { open: boolean; onOpenChange: (open: boolean) => void; defaults: DriverDefaults }

/** Adds several drivers at once from pasted lines or a CSV file. Each one gets the defaults and a vehicle of their own. */
export function AddDriversDialog({ open, onOpenChange, defaults }: Props) {
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const file = useRef<HTMLInputElement>(null)
  const create = useCreateFleetDrivers()
  const rows = parseDriverLines(text)
  const close = (next: boolean) => {
    if (!next) {
      setText('')
      setFileName(null)
      create.reset()
    }
    onOpenChange(next)
  }
  const add = () =>
    create.mutate(
      rows.map((r) => ({
        name: r.name,
        phone: r.phone,
        shift: defaults.shift,
        break: defaults.break,
        start: { kind: 'depot' },
        active: true,
        hasApp: false,
        vehicle: { use: 'new', spec: defaults.vehicle },
      })),
      {
        onSuccess: (added) => {
          toast.success(`Added ${added.length} driver${added.length === 1 ? '' : 's'}`)
          close(false)
        },
      },
    )
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add several drivers</DialogTitle>
          <DialogDescription>
            {`Paste one driver per line as name, phone, or choose a CSV file. The phone is optional. Each driver gets ${formatWindow(defaults.shift)}, ${formatBreak(defaults.break).toLowerCase()}, and a ${vehicleKindLabel[defaults.vehicle.kind].toLowerCase()} for ${defaults.vehicle.capacity} boxes.`}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="driver-lines">Drivers</Label>
          <Textarea
            id="driver-lines"
            rows={7}
            value={text}
            placeholder={'Budi Santoso, +62 812 0000 0101\nSari Wulandari, +62 812 0000 0102'}
            onChange={(e) => setText(e.target.value)}
            className="font-mono text-xs"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {rows.length ? `${rows.length} driver${rows.length === 1 ? '' : 's'} to add` : 'No drivers yet'}
              {fileName && ` from ${fileName}`}
            </span>
            <input
              ref={file}
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              className="sr-only"
              aria-label="CSV file of drivers"
              onChange={async (e) => {
                const chosen = e.target.files?.[0]
                if (!chosen) return
                setText(await chosen.text())
                setFileName(chosen.name)
                e.target.value = ''
              }}
            />
            <Button variant="outline" size="sm" onClick={() => file.current?.click()}>
              <FileUp aria-hidden="true" />
              Choose CSV file
            </Button>
          </div>
        </div>
        <ErrorNotice error={create.error} />
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>Cancel</Button>
          <Button disabled={!rows.length || create.isPending} onClick={add}>
            {rows.length > 1 ? `Add ${rows.length} drivers` : 'Add driver'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
