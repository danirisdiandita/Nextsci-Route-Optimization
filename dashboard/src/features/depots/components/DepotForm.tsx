import { ArrowRight } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import type { Depot, GeocodeCandidate } from '@/api/types'
import { AddressSearch } from '@/components/AddressSearch'
import { ErrorNotice } from '@/components/ErrorNotice'
import { FormField } from '@/components/FormField'
import { RouteMap } from '@/components/RouteMap'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { DepotInput } from '@/features/depots/api'
import { formatMinute, parseMinute } from '@/lib/time'

type Draft = { name: string; address: string; picked: GeocodeCandidate | null; open: string; close: string; loadMinutes: string }
type Field = 'name' | 'address' | 'hours' | 'loadMinutes'
type Errors = Partial<Record<Field, string>>

const emptyDraft: Draft = { name: '', address: '', picked: null, open: '08:00', close: '16:00', loadMinutes: '15' }

const draftOf = (d: Depot): Draft => ({
  name: d.name,
  address: d.address,
  picked: { address: d.address, location: d.location },
  open: formatMinute(d.hours.start),
  close: formatMinute(d.hours.end),
  loadMinutes: String(d.loadMinutes),
})

/** The pin stays only while the address text is the one the dispatcher picked. */
const pinOf = (d: Draft) => (d.picked && d.picked.address === d.address ? d.picked : null)

function parseDraft(d: Draft): { input: DepotInput } | { errors: Errors } {
  const errors: Errors = {}
  const pin = pinOf(d)
  const [start, end] = [parseMinute(d.open), parseMinute(d.close)]
  const load = Number(d.loadMinutes)
  if (!d.name.trim()) errors.name = 'Give the depot a name, such as the kitchen or warehouse.'
  if (!d.address.trim()) errors.address = 'Type the address and pick it from the list.'
  else if (!pin) errors.address = 'Pick the address from the list, so the pin lands in the right place.'
  if (start === null || end === null) errors.hours = 'Enter both times, such as 08:00 and 16:00.'
  else if (end <= start) errors.hours = 'Closing time must be after opening time.'
  if (d.loadMinutes.trim() === '' || !Number.isInteger(load) || load < 0) errors.loadMinutes = 'Enter whole minutes, 0 or more.'
  if (Object.keys(errors).length || !pin || start === null || end === null) return { errors }
  return { input: { name: d.name.trim(), address: pin.address, location: pin.location, hours: { start, end }, loadMinutes: load } }
}

type Props = {
  heading: string
  /** The depot to edit, or null for a new one. */
  depot: Depot | null
  submitLabel: string
  pending: boolean
  error: Error | null
  onSubmit: (input: DepotInput) => void
  /** The buttons left of the submit button, such as Back or Delete. */
  secondary: ReactNode
}

/** The depot form beside a map that shows where the depot pin lands (design NM 02). */
export function DepotForm({ heading, depot, submitLabel, pending, error, onSubmit, secondary }: Props) {
  const [draft, setDraft] = useState(() => (depot ? draftOf(depot) : emptyDraft))
  const [errors, setErrors] = useState<Errors>({})
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))
  const pin = pinOf(draft)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const parsed = parseDraft(draft)
    if ('errors' in parsed) return setErrors(parsed.errors)
    setErrors({})
    onSubmit(parsed.input)
  }
  return (
    <div className="grid flex-1 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
      <form noValidate onSubmit={submit} className="flex min-w-0 flex-col gap-5 p-6 lg:border-r">
        <h2 className="text-xl font-semibold tracking-[-0.012em]">{heading}</h2>
        <FormField label="Name" htmlFor="depot-name" error={errors.name}>
          <Input id="depot-name" value={draft.name} aria-invalid={!!errors.name || undefined} placeholder="Your kitchen or warehouse" onChange={(e) => set({ name: e.target.value })} />
        </FormField>
        <FormField
          label="Address"
          htmlFor="depot-address"
          error={errors.address}
          hint={pin ? `Pinned at ${pin.address}.` : 'Type a street, then pick the matching address.'}
        >
          <AddressSearch
            id="depot-address"
            value={draft.address}
            invalid={!!errors.address}
            placeholder="Jl. Layur, Yogyakarta"
            onChange={(address) => set({ address })}
            onPick={(c) => set({ address: c.address, picked: c })}
          />
        </FormField>
        <FormField label="Opening hours" htmlFor="depot-open" error={errors.hours} hint="Routes leave after opening and come back before closing.">
          <div className="flex items-center gap-3">
            <Input id="depot-open" type="time" aria-label="Opens at" className="w-32" value={draft.open} aria-invalid={!!errors.hours || undefined} onChange={(e) => set({ open: e.target.value })} />
            <span className="text-sm text-muted-foreground">to</span>
            <Input id="depot-close" type="time" aria-label="Closes at" className="w-32" value={draft.close} aria-invalid={!!errors.hours || undefined} onChange={(e) => set({ close: e.target.value })} />
          </div>
        </FormField>
        <FormField label="Loading time per route" htmlFor="depot-load" error={errors.loadMinutes} hint="Minutes to load a vehicle before each trip.">
          <div className="flex items-center gap-2">
            <Input id="depot-load" type="number" min={0} step={1} inputMode="numeric" className="w-24" value={draft.loadMinutes} aria-invalid={!!errors.loadMinutes || undefined} onChange={(e) => set({ loadMinutes: e.target.value })} />
            <span className="text-sm text-muted-foreground">min</span>
          </div>
        </FormField>
        <ErrorNotice error={error} />
        <div className="mt-auto flex items-center gap-2 pt-4">
          {secondary}
          <Button type="submit" className="ml-auto" disabled={pending}>
            {pending ? 'Saving…' : submitLabel}
            <ArrowRight aria-hidden="true" />
          </Button>
        </div>
      </form>
      <RouteMap
        label={pin ? `Map with the depot at ${pin.address}` : 'Map of Yogyakarta, with no depot pinned yet'}
        depot={pin?.location ?? null}
        className="min-h-[280px] max-lg:border-t"
      />
    </div>
  )
}
