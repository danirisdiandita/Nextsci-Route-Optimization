import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { VehicleKindSelect } from '@/features/drivers/components/VehicleKindSelect'
import type { DefaultsDraft, DefaultsErrors } from '@/lib/driverDefaults'

type Props = {
  draft: DefaultsDraft
  errors: DefaultsErrors
  onChange: (patch: Partial<DefaultsDraft>) => void
  driverCount: number
  pending: boolean
  onApply: () => void
}

/** The shift, break, and vehicle most drivers share, with a button that gives them to every driver. */
export function DefaultsBar({ draft, errors, onChange, driverCount, pending, onApply }: Props) {
  const field = (key: keyof DefaultsDraft, label: string, control: React.ReactNode, width: string) => (
    <div className={`grid gap-1.5 ${width}`}>
      <label htmlFor={`default-${key}`} className="text-xs font-[560]">{label}</label>
      {control}
      {errors[key] && <p className="text-xs text-[var(--danger-text)]">{errors[key]}</p>}
    </div>
  )
  return (
    <form
      aria-label="Driver defaults"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        onApply()
      }}
      className="flex flex-wrap items-start gap-x-3 gap-y-3 rounded-lg bg-inset p-3 sm:p-4"
    >
      {field('shift', 'Shift', <Input id="default-shift" className="bg-card" value={draft.shift} aria-invalid={!!errors.shift || undefined} onChange={(e) => onChange({ shift: e.target.value })} />, 'w-40')}
      {field('break', 'Break', <Input id="default-break" className="bg-card" value={draft.break} aria-invalid={!!errors.break || undefined} onChange={(e) => onChange({ break: e.target.value })} />, 'w-48')}
      {field('kind', 'Vehicle', <VehicleKindSelect id="default-kind" value={draft.kind} onChange={(kind) => onChange({ kind })} className="w-36 bg-card" />, 'w-36')}
      {field(
        'capacity',
        'Capacity',
        <div className="relative">
          <Input id="default-capacity" inputMode="numeric" className="bg-card pr-14" value={draft.capacity} aria-invalid={!!errors.capacity || undefined} onChange={(e) => onChange({ capacity: e.target.value })} />
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">boxes</span>
        </div>,
        'w-32',
      )}
      <Button type="submit" variant="outline" className="sm:mt-[22px] sm:ml-auto" disabled={pending || driverCount === 0}>
        {`Apply to all ${driverCount}`}
      </Button>
    </form>
  )
}
