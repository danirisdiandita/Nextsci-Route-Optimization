import { Bike, CircleHelp, UtensilsCrossed, Warehouse } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import type { VehicleKind } from '@/api/types'
import { vehicleKinds } from '@/api/types'
import { RouteMap } from '@/components/RouteMap'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  businessProfiles,
  businesses,
  describeBusiness,
  describeDepot,
  describeFleet,
  fleetSummary,
  vehicleLabels,
  type Business,
  type SetupDraft,
} from '@/features/assistant/api'
import { AskButton, Panel, StageActions, StageColumn, StageHeading } from '@/features/assistant/components/TodayParts'
import { useAgentBusy } from '@/features/assistant/hooks/useAgentBusy'
import { useAskAgent } from '@/features/assistant/hooks/useAskAgent'
import { useAgentPanel } from '@/hooks/useAgentPanel'
import { formatMinute, formatWindow, parseMinute } from '@/lib/time'

type Editing = 'depot' | 'business' | 'fleet' | null

/**
 * Design NS 02: what the agent understood, before anything is saved. Each card's Edit tells the agent the
 * change in a sentence, so the draft and the conversation stay the same thing.
 */
export function DraftStage({ draft, questions }: { draft: SetupDraft; questions: string[] }) {
  const [editing, setEditing] = useState<Editing>(null)
  const panel = useAgentPanel()
  const place = draft.geocode && draft.geocode.status !== 'not_found' ? draft.geocode : null
  const changeSomething = () => {
    panel.setOpen(true)
    requestAnimationFrame(() => document.getElementById('agent-composer')?.focus())
  }
  return (
    <StageColumn>
      <StageHeading eyebrow="Drafted by the agent · review before saving" title="Here's your setup" />
      <DraftCard icon={Warehouse} title="Depot" onEdit={() => setEditing(editing === 'depot' ? null : 'depot')}>
        {editing === 'depot' ? (
          <DepotForm address={draft.address ?? ''} onDone={() => setEditing(null)} />
        ) : (
          <>
            <RouteMap label={place ? `Map of the depot at ${draft.address}` : 'Map with no depot yet'} depot={place?.location ?? null} className="h-36 rounded-lg" />
            <p className="mt-3 text-xs text-muted-foreground">
              {place ? `${draft.address} · pin placed from your description` : draft.address ? `No place matches "${draft.address}" yet.` : 'Tell the agent where your drivers load.'}
            </p>
          </>
        )}
      </DraftCard>
      <div className="grid gap-4 sm:grid-cols-2">
        <DraftCard icon={UtensilsCrossed} title="Business" onEdit={() => setEditing(editing === 'business' ? null : 'business')}>
          {editing === 'business' ? (
            <BusinessForm business={draft.business} onDone={() => setEditing(null)} />
          ) : (
            <>
              <p className="text-sm text-foreground">{businessProfiles[draft.business].label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{businessProfiles[draft.business].note}</p>
            </>
          )}
        </DraftCard>
        <DraftCard icon={Bike} title="Fleet" onEdit={() => setEditing(editing === 'fleet' ? null : 'fleet')}>
          {editing === 'fleet' ? (
            <FleetForm draft={draft} onDone={() => setEditing(null)} />
          ) : (
            <>
              <p className="text-sm text-foreground">{draft.drivers === null ? 'How many drivers?' : fleetSummary(draft)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatWindow(draft.shift)}
                {draft.break ? ` · ${draft.break.minutes} min break ${formatWindow(draft.break.window)}` : ' · no break'}
              </p>
            </>
          )}
        </DraftCard>
      </div>
      {questions.length > 0 && (
        <Panel tone="warning">
          <ul className="grid gap-1.5 text-sm text-[var(--text-2)]">
            {questions.map((q) => (
              <li key={q} className="flex gap-2">
                <CircleHelp aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-[var(--warning)]" />
                {q}
              </li>
            ))}
          </ul>
        </Panel>
      )}
      <StageActions note="Nothing is saved until you continue.">
        <Button variant="outline" onClick={changeSomething}>
          Change something
        </Button>
        <AskButton say="Looks right, continue" disabled={questions.length > 0} />
      </StageActions>
    </StageColumn>
  )
}

function DraftCard({ icon: Icon, title, onEdit, children }: { icon: typeof Bike; title: string; onEdit: () => void; children: ReactNode }) {
  return (
    <Panel>
      <div className="mb-3 flex items-center gap-2">
        <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-[560]">{title}</h3>
        <Button variant="ghost" size="xs" className="ml-auto text-muted-foreground" onClick={onEdit} aria-label={`Edit ${title.toLowerCase()}`}>
          Edit
        </Button>
      </div>
      {children}
    </Panel>
  )
}

/** Sends one edit to the agent as a sentence, then closes the form. */
function EditForm({ sentence, onDone, children }: { sentence: () => string | null; onDone: () => void; children: ReactNode }) {
  const ask = useAskAgent()
  const busy = useAgentBusy()
  const [problem, setProblem] = useState<string | null>(null)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const text = sentence()
    if (!text) return setProblem('Check the times: each must be HH:MM, and end after it starts.')
    ask.mutate({ text }, { onSuccess: onDone })
  }
  return (
    <form onSubmit={submit} className="grid gap-3">
      {children}
      {problem && <p className="text-xs text-[var(--danger-text)]">{problem}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={busy}>
          Tell the agent
        </Button>
      </div>
    </form>
  )
}

function DepotForm({ address, onDone }: { address: string; onDone: () => void }) {
  const [value, setValue] = useState(address)
  return (
    <EditForm sentence={() => (value.trim() ? describeDepot(value) : null)} onDone={onDone}>
      <div className="grid gap-2">
        <Label htmlFor="draft-address">Address</Label>
        <Input id="draft-address" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Jl. Layur VII No.12, Yogyakarta" />
      </div>
    </EditForm>
  )
}

function BusinessForm({ business, onDone }: { business: Business; onDone: () => void }) {
  const [value, setValue] = useState(business)
  return (
    <EditForm sentence={() => describeBusiness(value)} onDone={onDone}>
      <div className="grid gap-2">
        <Label htmlFor="draft-business">Kind of business</Label>
        <Choice id="draft-business" value={value} onChange={setValue} options={businesses.map((b) => ({ value: b, label: businessProfiles[b].label }))} />
      </div>
    </EditForm>
  )
}

function FleetForm({ draft, onDone }: { draft: SetupDraft; onDone: () => void }) {
  const [drivers, setDrivers] = useState(String(draft.drivers ?? ''))
  const [kind, setKind] = useState<VehicleKind>(draft.vehicleKind)
  const [capacity, setCapacity] = useState(String(draft.capacity))
  const [start, setStart] = useState(formatMinute(draft.shift.start))
  const [end, setEnd] = useState(formatMinute(draft.shift.end))
  const [breakMinutes, setBreakMinutes] = useState(draft.break ? String(draft.break.minutes) : '0')
  const [breakFrom, setBreakFrom] = useState(formatMinute(draft.break?.window.start ?? 12 * 60))
  const [breakTo, setBreakTo] = useState(formatMinute(draft.break?.window.end ?? 13 * 60))
  const sentence = () => {
    const [s, e, bf, bt] = [start, end, breakFrom, breakTo].map(parseMinute)
    const n = Number(drivers)
    const minutes = Number(breakMinutes)
    if (s === null || e === null || s >= e || !(n >= 1) || !(Number(capacity) >= 1)) return null
    if (minutes > 0 && (bf === null || bt === null || bf >= bt)) return null
    return describeFleet({
      drivers: Math.round(n),
      vehicleKind: kind,
      capacity: Math.round(Number(capacity)),
      shift: { start: s, end: e },
      break: minutes > 0 ? { minutes, window: { start: bf!, end: bt! } } : null,
    })
  }
  const field = (id: string, label: string, value: string, set: (v: string) => void, type = 'text') => (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} inputMode={type === 'number' ? 'numeric' : undefined} value={value} onChange={(e) => set(e.target.value)} />
    </div>
  )
  return (
    <EditForm sentence={sentence} onDone={onDone}>
      <div className="grid grid-cols-2 gap-3">
        {field('draft-drivers', 'Drivers', drivers, setDrivers, 'number')}
        <div className="grid gap-1.5">
          <Label htmlFor="draft-kind">Vehicle</Label>
          <Choice id="draft-kind" value={kind} onChange={setKind} options={vehicleKinds.map((k) => ({ value: k, label: vehicleLabels[k].one }))} />
        </div>
        {field('draft-capacity', 'Boxes each', capacity, setCapacity, 'number')}
        {field('draft-break', 'Break minutes (0 for none)', breakMinutes, setBreakMinutes, 'number')}
        {field('draft-start', 'Shift starts', start, setStart, 'time')}
        {field('draft-end', 'Shift ends', end, setEnd, 'time')}
        {Number(breakMinutes) > 0 && field('draft-break-from', 'Break from', breakFrom, setBreakFrom, 'time')}
        {Number(breakMinutes) > 0 && field('draft-break-to', 'Break until', breakTo, setBreakTo, 'time')}
      </div>
    </EditForm>
  )
}

function Choice<T extends string>({ id, value, onChange, options }: { id: string; value: T; onChange: (value: T) => void; options: { value: T; label: string }[] }) {
  return (
    <Select items={options} value={value} onValueChange={(v) => v && onChange(v as T)}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
