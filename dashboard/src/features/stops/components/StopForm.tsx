import { useState, type ReactNode } from 'react'
import { ErrorNotice } from '@/components/ErrorNotice'
import { FormField } from '@/components/FormField'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { OrderInput } from '@/features/stops/api'
import { parseDraft, type StopDraft } from '@/features/stops/stopForm'

type Props = {
  initial: StopDraft
  /** The buttons at the bottom. The submit button needs `type="submit"`. */
  actions: ReactNode
  error: Error | null
  onSubmit: (input: OrderInput) => void
}

/** The fields of one stop. The address is placed on the map when the stop is saved. */
export function StopForm({ initial, actions, error, onSubmit }: Props) {
  const [draft, setDraft] = useState(initial)
  const [formError, setFormError] = useState<string | null>(null)
  const field = (key: keyof StopDraft) => ({
    id: `stop-${key}`,
    name: key,
    value: draft[key],
    onChange: (e: { target: { value: string } }) => setDraft((d) => ({ ...d, [key]: e.target.value })),
  })
  return (
    <form
      noValidate
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        const parsed = parseDraft(draft)
        if ('error' in parsed) return setFormError(parsed.error)
        setFormError(null)
        onSubmit(parsed.input)
      }}
    >
      <div className="grid items-start gap-5 sm:grid-cols-2">
        <FormField label="Customer name" htmlFor="stop-customer">
          <Input {...field('customer')} required autoComplete="off" />
        </FormField>
        <FormField label="Phone" htmlFor="stop-phone" hint="Optional. For delivery updates.">
          <Input {...field('phone')} type="tel" autoComplete="off" />
        </FormField>
      </div>
      <FormField label="Address" htmlFor="stop-addressRaw" hint="Placed on the map when you save.">
        <Input {...field('addressRaw')} required autoComplete="off" />
      </FormField>
      <div className="grid items-start gap-5 sm:grid-cols-2">
        <FormField label="Load (boxes)" htmlFor="stop-quantity">
          <Input {...field('quantity')} type="number" min={1} step={1} inputMode="numeric" />
        </FormField>
        <FormField label="Service time (min)" htmlFor="stop-serviceMinutes" hint="Empty uses the plan's service time.">
          <Input {...field('serviceMinutes')} type="number" min={0} step={1} inputMode="numeric" placeholder="Plan default" />
        </FormField>
      </div>
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">Time window</legend>
        <div className="flex items-center gap-2">
          <Input {...field('windowStart')} type="time" aria-label="Window start" className="w-36" />
          <span className="text-muted-foreground">to</span>
          <Input {...field('windowEnd')} type="time" aria-label="Window end" className="w-36" />
        </div>
        <p className="text-xs text-muted-foreground">Leave both empty to deliver any time.</p>
      </fieldset>
      <FormField label="Notes for driver" htmlFor="stop-notes">
        <Textarea {...field('notes')} rows={3} />
      </FormField>
      <ErrorNotice error={formError ? new Error(formError) : error} />
      <div className="flex flex-wrap justify-between gap-3">{actions}</div>
    </form>
  )
}
