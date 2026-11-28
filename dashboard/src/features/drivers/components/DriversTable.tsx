import { Link } from '@tanstack/react-router'
import { Check, Pencil, X } from 'lucide-react'
import { useState, type KeyboardEvent } from 'react'
import { toast } from 'sonner'
import type { Driver, Vehicle, VehicleKind } from '@/api/types'
import { ErrorNotice } from '@/components/ErrorNotice'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { VehicleKindSelect } from '@/features/drivers/components/VehicleKindSelect'
import { useUpdateFleetDriver } from '@/features/drivers/hooks/useUpdateFleetDriver'
import { differences, parseCapacity, vehicleKindLabel, vehicleOf, type DriverDefaults } from '@/lib/driverDefaults'
import { formatWindow, parseWindow } from '@/lib/time'

type Props = { drivers: Driver[]; vehicles: Vehicle[]; defaults: DriverDefaults }

/** Every driver with their shift and vehicle. A cell that differs from the defaults is bold, and a row edits in place. */
export function DriversTable({ drivers, vehicles, defaults }: Props) {
  const [editing, setEditing] = useState<Driver['id'] | null>(null)
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table className="min-w-[880px]">
        <TableHeader className="bg-inset">
          <TableRow>
            <TableHead className="w-[22%]">Name</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Shift</TableHead>
            <TableHead>Vehicle</TableHead>
            <TableHead>Capacity</TableHead>
            <TableHead>Start / end</TableHead>
            <TableHead className="w-12"><span className="sr-only">Edit</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {drivers.map((driver) =>
            editing === driver.id ? (
              <EditRow key={driver.id} driver={driver} vehicle={vehicleOf(driver, vehicles)} onDone={() => setEditing(null)} />
            ) : (
              <ViewRow key={driver.id} driver={driver} vehicle={vehicleOf(driver, vehicles)} defaults={defaults} onEdit={() => setEditing(driver.id)} />
            ),
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function ViewRow({ driver, vehicle, defaults, onEdit }: { driver: Driver; vehicle: Vehicle | undefined; defaults: DriverDefaults; onEdit: () => void }) {
  const differs = differences(driver, vehicle, defaults)
  const bold = (field: Parameters<typeof differs.has>[0]) => (differs.has(field) ? 'font-[650] text-foreground' : 'text-[var(--text-2)]')
  return (
    <TableRow data-differs={differs.size > 0 || undefined} className="data-differs:bg-[color-mix(in_srgb,var(--warning)_9%,transparent)]">
      <TableCell className="font-[560]">
        <span className="flex items-center gap-2">
          <Link to="/drivers/$driverId" params={{ driverId: driver.id }} className="hover:underline">
            {driver.name}
          </Link>
          {!driver.active && <Badge variant="outline">Off</Badge>}
        </span>
      </TableCell>
      <TableCell className="text-[var(--text-2)] tabular-nums">{driver.phone ?? <span className="text-muted-foreground">No phone</span>}</TableCell>
      <TableCell className={`tabular-nums ${bold('shift')}`}>{formatWindow(driver.shift)}</TableCell>
      <TableCell className={bold('kind')}>{vehicle ? vehicleKindLabel[vehicle.kind] : <span className="text-muted-foreground">No vehicle</span>}</TableCell>
      <TableCell className={`tabular-nums ${bold('capacity')}`}>{vehicle ? `${vehicle.capacity} boxes` : '–'}</TableCell>
      <TableCell className="text-[var(--text-2)]">{driver.start.kind === 'home' ? 'Home → Depot' : 'Depot'}</TableCell>
      <TableCell>
        <Button variant="ghost" size="icon-sm" aria-label={`Edit ${driver.name}`} onClick={onEdit}>
          <Pencil aria-hidden="true" />
        </Button>
      </TableCell>
    </TableRow>
  )
}

type RowDraft = { name: string; phone: string; shift: string; kind: VehicleKind; capacity: string }

function EditRow({ driver, vehicle, onDone }: { driver: Driver; vehicle: Vehicle | undefined; onDone: () => void }) {
  const update = useUpdateFleetDriver()
  const [draft, setDraft] = useState<RowDraft>({
    name: driver.name,
    phone: driver.phone ?? '',
    shift: formatWindow(driver.shift),
    kind: vehicle?.kind ?? 'motorbike',
    capacity: vehicle ? String(vehicle.capacity) : '10',
  })
  const [problem, setProblem] = useState<Error | null>(null)
  const set = (patch: Partial<RowDraft>) => setDraft((d) => ({ ...d, ...patch }))
  const save = () => {
    const shift = parseWindow(draft.shift)
    const capacity = parseCapacity(draft.capacity)
    if (!draft.name.trim()) return setProblem(new Error('Name is required.'))
    if (!shift) return setProblem(new Error('Write the shift as 08:00–16:00.'))
    if (capacity === null) return setProblem(new Error('Capacity is a whole number of boxes, 1 or more.'))
    setProblem(null)
    const spec = { kind: draft.kind, capacity }
    update.mutate(
      {
        driverId: driver.id,
        patch: {
          name: draft.name,
          phone: draft.phone,
          shift,
          vehicle: vehicle ? { use: 'existing', vehicleId: vehicle.id, spec } : { use: 'new', spec },
        },
      },
      {
        onSuccess: (d) => {
          toast.success(`${d.name} saved`)
          onDone()
        },
      },
    )
  }
  const keys = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      save()
    } else if (e.key === 'Escape') onDone()
  }
  const error = problem ?? update.error
  return (
    <>
      <TableRow onKeyDown={keys} className="bg-inset hover:bg-inset">
        <TableCell><Input aria-label="Name" value={draft.name} autoFocus onChange={(e) => set({ name: e.target.value })} className="h-8" /></TableCell>
        <TableCell><Input aria-label="Phone" value={draft.phone} placeholder="Optional" onChange={(e) => set({ phone: e.target.value })} className="h-8" /></TableCell>
        <TableCell><Input aria-label="Shift" value={draft.shift} onChange={(e) => set({ shift: e.target.value })} className="h-8 w-32" /></TableCell>
        <TableCell><VehicleKindSelect label="Vehicle" value={draft.kind} onChange={(kind) => set({ kind })} className="h-8 w-32" /></TableCell>
        <TableCell><Input aria-label="Capacity" inputMode="numeric" value={draft.capacity} onChange={(e) => set({ capacity: e.target.value })} className="h-8 w-20" /></TableCell>
        <TableCell className="text-[var(--text-2)]">
          <Link to="/drivers/$driverId" params={{ driverId: driver.id }} className="text-brand hover:underline">
            {driver.start.kind === 'home' ? 'Home → Depot' : 'Depot'}
          </Link>
        </TableCell>
        <TableCell>
          <span className="flex gap-1">
            <Button size="icon-sm" aria-label="Save" disabled={update.isPending} onClick={save}>
              <Check aria-hidden="true" />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Cancel" onClick={onDone}>
              <X aria-hidden="true" />
            </Button>
          </span>
        </TableCell>
      </TableRow>
      {error && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={7}><ErrorNotice error={error} /></TableCell>
        </TableRow>
      )}
    </>
  )
}
