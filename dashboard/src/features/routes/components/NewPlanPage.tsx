import { useNavigate } from '@tanstack/react-router'
import { CircleAlert, CircleCheck, Route as RouteIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { planGoals, type Day, type DepotId, type DriverId, type PlanGoal } from '@/api/types'
import { ErrorNotice } from '@/components/ErrorNotice'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { goalCopy, planSummary } from '@/features/routes/plan'
import { useCreatePlan } from '@/hooks/useCreatePlan'
import { useDepots } from '@/hooks/useDepots'
import { useDrivers } from '@/hooks/useDrivers'
import { useOrders } from '@/hooks/useOrders'
import { useVehicles } from '@/hooks/useVehicles'
import { formatWindow, todayDay } from '@/lib/time'

/** The last setup step: the day, the drivers, the goal, and the rules, with what the plan will hold beside them. */
export function NewPlanPage() {
  const { data: depots } = useDepots()
  const { data: drivers } = useDrivers()
  const { data: vehicles } = useVehicles()
  const { data: orders } = useOrders()
  if (!depots || !drivers || !vehicles || !orders) return null
  return <PlanSettingsForm />
}

function PlanSettingsForm() {
  const navigate = useNavigate()
  const { data: depots = [] } = useDepots()
  const { data: drivers = [] } = useDrivers()
  const { data: vehicles = [] } = useVehicles()
  const { data: orders = [] } = useOrders()
  const create = useCreatePlan()
  const [day, setDay] = useState<Day>(todayDay)
  const [depotId, setDepotId] = useState<DepotId | null>(depots[0]?.id ?? null)
  const [driverIds, setDriverIds] = useState<DriverId[]>(() => drivers.filter((d) => d.active && d.vehicleId).map((d) => d.id))
  const [goal, setGoal] = useState<PlanGoal>('min_time')
  const [allowReloads, setAllowReloads] = useState(true)
  const [strictWindows, setStrictWindows] = useState(true)
  const [serviceText, setServiceText] = useState('4')
  const summary = planSummary(orders, drivers, vehicles, driverIds)
  const reloadsNeeded = summary.load > summary.capacity
  const serviceMinutes = Number(serviceText)
  const serviceError = serviceText.trim() === '' || !Number.isInteger(serviceMinutes) || serviceMinutes < 0 ? 'Enter whole minutes, such as 4.' : null
  const toggle = (id: DriverId) => setDriverIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
  const offNames = drivers.filter((d) => d.vehicleId && !driverIds.includes(d.id)).map((d) => d.name.split(' ')[0])
  const submit = () => {
    if (!depotId || serviceError) return
    create.mutate(
      { day, depotId, driverIds, goal, allowReloads, strictWindows, serviceMinutes },
      { onSuccess: () => navigate({ to: '/routes' }) },
    )
  }
  return (
    <form
      className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <div className="grid gap-6">
        <div className="flex flex-wrap gap-4">
          <div className="grid gap-2">
            <Label htmlFor="plan-day">Date</Label>
            <Input id="plan-day" type="date" className="w-[200px]" value={day} required onChange={(e) => e.target.value && setDay(e.target.value as Day)} />
          </div>
          {depots.length > 1 && (
            <div className="grid gap-2">
              <Label htmlFor="plan-depot">Depot</Label>
              <Select value={depotId} onValueChange={(v) => setDepotId(v as DepotId)} items={depots.map((d) => ({ value: d.id, label: d.name }))}>
                <SelectTrigger id="plan-depot" className="w-[240px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {depots.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <fieldset className="grid gap-2">
          <div className="flex items-center justify-between">
            <legend className="text-sm font-[560]">Drivers</legend>
            <Button
              type="button"
              variant="link"
              size="xs"
              className="text-brand"
              onClick={() => setDriverIds(drivers.filter((d) => d.vehicleId).map((d) => d.id))}
            >
              Select all
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {drivers.map((d) => {
              const on = driverIds.includes(d.id)
              const first = d.name.split(' ')[0]
              const note = !d.vehicleId ? ' · no vehicle' : !d.active ? ' · off today' : ''
              return (
                <button
                  key={d.id}
                  type="button"
                  aria-pressed={on}
                  disabled={!d.vehicleId}
                  onClick={() => toggle(d.id)}
                  className={`h-7 rounded-full border px-3 text-xs transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 ${
                    on ? 'border-transparent bg-brand-soft font-[560] text-foreground' : 'bg-background text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {first + note}
                </button>
              )
            })}
          </div>
          {!drivers.length && <p className="text-sm text-muted-foreground">Add drivers before you plan.</p>}
        </fieldset>

        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-[560]">Goal</legend>
          <RadioGroup value={goal} onValueChange={(v) => setGoal(v as PlanGoal)} className="gap-0 overflow-hidden rounded-lg border bg-card">
            {planGoals.map((g) => (
              <Label key={g} className="flex cursor-pointer items-start gap-3 border-t px-4 py-3 font-normal first:border-t-0 has-data-checked:bg-muted">
                <RadioGroupItem value={g} className="mt-0.5" />
                <span className="grid gap-0.5">
                  <span className="font-[560]">{goalCopy[g].title}</span>
                  <span className="text-xs text-muted-foreground">{goalCopy[g].hint}</span>
                </span>
              </Label>
            ))}
          </RadioGroup>
        </fieldset>

        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-[560]">Rules</legend>
          <div className="overflow-hidden rounded-lg border bg-card">
            <Rule
              id="rule-reloads"
              title="Return to depot to reload"
              hint={
                reloadsNeeded
                  ? `Needed today. ${summary.load} boxes, ${summary.capacity} per trip${offNames.length ? ` with ${offNames.join(', ')} off` : ''}.`
                  : 'Off: each driver makes one trip.'
              }
              warn={reloadsNeeded}
            >
              <Switch id="rule-reloads" checked={allowReloads} onCheckedChange={setAllowReloads} />
            </Rule>
            <Rule id="rule-windows" title="Time windows are strict" hint="Off: a stop may be late if it saves a lot of driving.">
              <Switch id="rule-windows" checked={strictWindows} onCheckedChange={setStrictWindows} />
            </Rule>
            <Rule id="rule-service" title="Service time per stop" hint={serviceError ?? 'For stops that do not set their own.'} error={!!serviceError}>
              <div className="flex items-center gap-2">
                <Input id="rule-service" inputMode="numeric" className="w-16 text-right" value={serviceText} aria-invalid={!!serviceError} onChange={(e) => setServiceText(e.target.value)} />
                <span className="text-sm text-muted-foreground">min</span>
              </div>
            </Rule>
          </div>
        </fieldset>
      </div>

      <aside aria-labelledby="plan-summary" className="grid gap-4 rounded-xl border bg-inset p-5 lg:sticky lg:top-6">
        <h2 id="plan-summary" className="font-[560]">This plan</h2>
        <dl className="grid gap-3 text-sm">
          <SummaryRow label="Stops" value={String(summary.stops)} />
          <SummaryRow label="Drivers" value={`${summary.drivers} of ${drivers.length}`} />
          <SummaryRow label="Load" value={`${summary.load} boxes`} />
          <SummaryRow label="Capacity per trip" value={`${summary.capacity} boxes`} />
          <SummaryRow label="Working hours" value={summary.hours ? formatWindow(summary.hours) : '–'} />
        </dl>
        <ul className="grid gap-2 border-t pt-4 text-xs">
          <Check ok={summary.located === summary.stops}>
            {summary.located === summary.stops ? 'All stops have a location' : summary.stops - summary.located === 1 ? '1 stop has no location and stays off the routes' : `${summary.stops - summary.located} stops have no location and stay off the routes`}
          </Check>
          <Check ok={!reloadsNeeded || allowReloads}>
            {!reloadsNeeded ? 'One trip each covers the load' : allowReloads ? 'Reloads cover the load' : 'Turn on reloads, or some stops stay off the routes'}
          </Check>
        </ul>
        <ErrorNotice error={create.error} />
        <Button type="submit" size="lg" disabled={create.isPending || !depotId || !!serviceError}>
          <RouteIcon aria-hidden="true" />
          {create.isPending ? 'Planning…' : 'Plan routes'}
        </Button>
      </aside>
    </form>
  )
}

function Rule({ id, title, hint, warn, error, children }: { id: string; title: string; hint: string; warn?: boolean; error?: boolean; children: ReactNode }) {
  return (
    <div
      className="flex items-center justify-between gap-4 border-t px-4 py-3 first:border-t-0"
      style={warn ? { background: 'color-mix(in srgb, var(--warning) 8%, transparent)' } : undefined}
    >
      <div className="grid gap-0.5">
        <Label htmlFor={id}>{title}</Label>
        <span className={`text-xs ${error ? 'text-[var(--danger-text)]' : warn ? 'text-[var(--warning)]' : 'text-muted-foreground'}`}>{hint}</span>
      </div>
      {children}
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-[var(--text-2)]">{label}</dt>
      <dd className="font-[560] tabular-nums">{value}</dd>
    </div>
  )
}

function Check({ ok, children }: { ok: boolean; children: ReactNode }) {
  const Icon = ok ? CircleCheck : CircleAlert
  return (
    <li className="flex items-center gap-2 text-[var(--text-2)]">
      <Icon aria-hidden="true" className={`size-3.5 shrink-0 ${ok ? 'text-[var(--success)]' : 'text-[var(--warning)]'}`} />
      {children}
    </li>
  )
}
