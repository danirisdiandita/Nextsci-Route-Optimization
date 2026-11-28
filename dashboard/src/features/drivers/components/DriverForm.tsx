import { Link } from '@tanstack/react-router'
import { useState, type FormEvent, type ReactNode } from 'react'
import type { Driver, GeocodeCandidate, Vehicle, VehicleId, VehicleKind } from '@/api/types'
import { AddressSearch } from '@/components/AddressSearch'
import { ErrorNotice } from '@/components/ErrorNotice'
import { FormField } from '@/components/FormField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { VehicleKindSelect } from '@/features/drivers/components/VehicleKindSelect'
import type { FleetDriverInput } from '@/features/drivers/api'
import { parseCapacity, vehicleKindLabel, type DriverDefaults } from '@/lib/driverDefaults'
import { formatMinute, parseMinute } from '@/lib/time'

/** Which vehicle the form picks: none, a new one, or the id of one that exists. */
type VehiclePick = 'none' | 'new' | VehicleId

type Draft = {
  name: string
  phone: string
  shiftStart: string
  shiftEnd: string
  hasBreak: boolean
  breakMinutes: string
  breakStart: string
  breakEnd: string
  vehicle: VehiclePick
  newKind: VehicleKind
  newCapacity: string
  start: 'depot' | 'home'
  home: string
  homePicked: GeocodeCandidate | null
  active: boolean
  hasApp: boolean
}
type Errors = Partial<Record<'name' | 'shift' | 'break' | 'vehicle' | 'home', string>>

function draftOf(driver: Driver | null, defaults: DriverDefaults): Draft {
  const shift = driver?.shift ?? defaults.shift
  const brk = driver ? driver.break : defaults.break
  const lunch = brk ?? defaults.break ?? { window: { start: 690, end: 780 }, minutes: 30 }
  return {
    name: driver?.name ?? '',
    phone: driver?.phone ?? '',
    shiftStart: formatMinute(shift.start),
    shiftEnd: formatMinute(shift.end),
    hasBreak: brk !== null,
    breakMinutes: String(lunch.minutes),
    breakStart: formatMinute(lunch.window.start),
    breakEnd: formatMinute(lunch.window.end),
    vehicle: driver ? (driver.vehicleId ?? 'none') : 'new',
    newKind: defaults.vehicle.kind,
    newCapacity: String(defaults.vehicle.capacity),
    start: driver?.start.kind ?? 'depot',
    home: driver?.start.kind === 'home' ? driver.start.address : '',
    homePicked: driver?.start.kind === 'home' ? { address: driver.start.address, location: driver.start.location } : null,
    active: driver?.active ?? true,
    hasApp: driver?.hasApp ?? false,
  }
}

function parseDraft(d: Draft): { input: FleetDriverInput } | { errors: Errors } {
  const errors: Errors = {}
  const [shiftStart, shiftEnd] = [parseMinute(d.shiftStart), parseMinute(d.shiftEnd)]
  const [breakStart, breakEnd] = [parseMinute(d.breakStart), parseMinute(d.breakEnd)]
  const breakMinutes = Number(d.breakMinutes)
  const capacity = parseCapacity(d.newCapacity)
  const home = d.homePicked && d.homePicked.address === d.home ? d.homePicked : null
  if (!d.name.trim()) errors.name = 'Name is required.'
  if (shiftStart === null || shiftEnd === null || shiftEnd <= shiftStart) errors.shift = 'The shift must end after it starts.'
  if (d.hasBreak) {
    if (breakStart === null || breakEnd === null || breakEnd <= breakStart) errors.break = 'The break window must end after it starts.'
    else if (!Number.isInteger(breakMinutes) || breakMinutes < 1 || breakMinutes > breakEnd - breakStart) errors.break = 'The break must be whole minutes that fit in its window.'
  }
  if (d.vehicle === 'new' && capacity === null) errors.vehicle = 'Capacity is a whole number of boxes, 1 or more.'
  if (d.start === 'home' && !home) errors.home = 'Pick the home address from the list.'
  if (Object.keys(errors).length || shiftStart === null || shiftEnd === null) return { errors }
  return {
    input: {
      name: d.name,
      phone: d.phone,
      shift: { start: shiftStart, end: shiftEnd },
      break: d.hasBreak && breakStart !== null && breakEnd !== null ? { window: { start: breakStart, end: breakEnd }, minutes: breakMinutes } : null,
      start: home && d.start === 'home' ? { kind: 'home', address: home.address, location: home.location } : { kind: 'depot' },
      active: d.active,
      hasApp: d.hasApp,
      vehicle:
        d.vehicle === 'none'
          ? { use: 'none' }
          : d.vehicle === 'new'
            ? { use: 'new', spec: { kind: d.newKind, capacity: capacity ?? 1 } }
            : { use: 'existing', vehicleId: d.vehicle },
    },
  }
}

type Props = {
  heading: string
  /** The driver to edit, or null for a new one. */
  driver: Driver | null
  vehicles: Vehicle[]
  defaults: DriverDefaults
  submitLabel: string
  pending: boolean
  error: Error | null
  onSubmit: (input: FleetDriverInput) => void
  /** Buttons left of the submit button, such as Back and Delete. */
  secondary: ReactNode
}

/** Everything about one driver: contact, shift, break, vehicle, where the day starts, and whether they work. */
export function DriverForm({ heading, driver, vehicles, defaults, submitLabel, pending, error, onSubmit, secondary }: Props) {
  const [draft, setDraft] = useState(() => draftOf(driver, defaults))
  const [errors, setErrors] = useState<Errors>({})
  const fieldOf: Partial<Record<keyof Draft, keyof Errors>> = {
    name: 'name', shiftStart: 'shift', shiftEnd: 'shift', hasBreak: 'break', breakMinutes: 'break', breakStart: 'break', breakEnd: 'break',
    vehicle: 'vehicle', newCapacity: 'vehicle', start: 'home', home: 'home', homePicked: 'home',
  }
  /** Changes the draft and clears the errors of the fields the dispatcher is fixing. */
  const set = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }))
    const fixed = new Set(Object.keys(patch).map((k) => fieldOf[k as keyof Draft]))
    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !fixed.has(k as keyof Errors))))
  }
  const picked = draft.vehicle !== 'none' && draft.vehicle !== 'new' ? vehicles.find((v) => v.id === draft.vehicle) : undefined
  const vehicleItems: Record<string, string> = {
    new: 'New vehicle',
    none: 'No vehicle',
    ...Object.fromEntries(vehicles.map((v) => [v.id, `${v.name} · ${v.capacity} boxes`])),
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const parsed = parseDraft(draft)
    if ('errors' in parsed) return setErrors(parsed.errors)
    setErrors({})
    onSubmit(parsed.input)
  }
  return (
    <form noValidate onSubmit={submit} className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 p-4 sm:p-6">
      <h2 className="text-xl font-semibold tracking-[-0.012em]">{heading}</h2>
      <div className="grid items-start gap-5 sm:grid-cols-2">
        <FormField label="Name" htmlFor="driver-name" error={errors.name}>
          <Input id="driver-name" value={draft.name} aria-invalid={!!errors.name || undefined} onChange={(e) => set({ name: e.target.value })} />
        </FormField>
        <FormField label="Phone" htmlFor="driver-phone" hint="Optional. Without one, share the route link by hand.">
          <Input id="driver-phone" type="tel" value={draft.phone} placeholder="+62 812 0000 0101" onChange={(e) => set({ phone: e.target.value })} />
        </FormField>
      </div>

      <FormField label="Shift" htmlFor="driver-shift-start" error={errors.shift}>
        <div className="flex items-center gap-3">
          <Input id="driver-shift-start" type="time" aria-label="Shift starts" className="w-32" value={draft.shiftStart} onChange={(e) => set({ shiftStart: e.target.value })} />
          <span className="text-sm text-muted-foreground">to</span>
          <Input type="time" aria-label="Shift ends" className="w-32" value={draft.shiftEnd} onChange={(e) => set({ shiftEnd: e.target.value })} />
        </div>
      </FormField>

      <div className="grid gap-2">
        <Label className="gap-3">
          <Switch checked={draft.hasBreak} onCheckedChange={(hasBreak) => set({ hasBreak })} />
          Takes a break
        </Label>
        {draft.hasBreak && (
          <div className="flex flex-wrap items-center gap-3">
            <Input aria-label="Break minutes" inputMode="numeric" className="w-20" value={draft.breakMinutes} onChange={(e) => set({ breakMinutes: e.target.value })} />
            <span className="text-sm text-muted-foreground">min, between</span>
            <Input type="time" aria-label="Break window starts" className="w-32" value={draft.breakStart} onChange={(e) => set({ breakStart: e.target.value })} />
            <span className="text-sm text-muted-foreground">and</span>
            <Input type="time" aria-label="Break window ends" className="w-32" value={draft.breakEnd} onChange={(e) => set({ breakEnd: e.target.value })} />
          </div>
        )}
        {errors.break && <p className="text-xs text-[var(--danger-text)]">{errors.break}</p>}
      </div>

      <FormField
        label="Vehicle"
        htmlFor="driver-vehicle"
        error={errors.vehicle}
        hint={
          picked ? (
            <>
              {`${vehicleKindLabel[picked.kind]}, ${picked.capacity} boxes. `}
              <Link to="/drivers/vehicles" className="text-brand hover:underline">Edit vehicles</Link>
            </>
          ) : draft.vehicle === 'none' ? (
            'A driver without a vehicle is left out of plans.'
          ) : undefined
        }
      >
        <div className="flex flex-wrap gap-3">
          <Select items={vehicleItems} value={draft.vehicle as string} onValueChange={(v) => v && set({ vehicle: v as VehiclePick })}>
            <SelectTrigger id="driver-vehicle" className="min-w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(vehicleItems).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {draft.vehicle === 'new' && (
            <>
              <VehicleKindSelect label="Kind" value={draft.newKind} onChange={(newKind) => set({ newKind })} className="w-36" />
              <div className="relative w-32">
                <Input aria-label="Capacity" inputMode="numeric" className="pr-14" value={draft.newCapacity} onChange={(e) => set({ newCapacity: e.target.value })} />
                <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">boxes</span>
              </div>
            </>
          )}
        </div>
      </FormField>

      <div className="grid gap-2">
        <span className="text-sm font-medium" id="driver-start-label">Starts the day at</span>
        <RadioGroup aria-labelledby="driver-start-label" value={draft.start} onValueChange={(v) => set({ start: v as Draft['start'] })} className="flex gap-6">
          <Label className="font-normal"><RadioGroupItem value="depot" />The depot</Label>
          <Label className="font-normal"><RadioGroupItem value="home" />Home</Label>
        </RadioGroup>
        {draft.start === 'home' && (
          <>
            <AddressSearch
              id="driver-home"
              value={draft.home}
              invalid={!!errors.home}
              placeholder="Home address"
              onChange={(home) => set({ home })}
              onPick={(c) => set({ home: c.address, homePicked: c })}
            />
            <p className={`text-xs ${errors.home ? 'text-[var(--danger-text)]' : 'text-muted-foreground'}`}>
              {errors.home ?? 'The route starts here and ends at the depot.'}
            </p>
          </>
        )}
      </div>

      <div className="grid gap-3 rounded-lg border p-4">
        <Label className="justify-between font-normal">
          <span>
            <span className="block font-medium">Working</span>
            <span className="mt-1 block text-xs text-muted-foreground">Drivers who are off are left out of new plans.</span>
          </span>
          <Switch checked={draft.active} onCheckedChange={(active) => set({ active })} />
        </Label>
        <Label className="justify-between font-normal">
          <span>
            <span className="block font-medium">Has the Nextsci app</span>
            <span className="mt-1 block text-xs text-muted-foreground">Routes go to the app. Without it, the driver gets a link.</span>
          </span>
          <Switch checked={draft.hasApp} onCheckedChange={(hasApp) => set({ hasApp })} />
        </Label>
      </div>

      <ErrorNotice error={error} />
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
        {secondary}
        <Button type="submit" className="ml-auto" disabled={pending}>
          {pending ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  )
}
