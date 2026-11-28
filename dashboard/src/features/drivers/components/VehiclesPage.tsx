import { Link } from '@tanstack/react-router'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useState, type KeyboardEvent } from 'react'
import { toast } from 'sonner'
import type { Depot, Driver, Vehicle, VehicleId, VehicleKind } from '@/api/types'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ErrorNotice } from '@/components/ErrorNotice'
import { HeaderSlot } from '@/components/HeaderSlot'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { VehicleKindSelect } from '@/features/drivers/components/VehicleKindSelect'
import { useCreateVehicle } from '@/features/drivers/hooks/useCreateVehicle'
import { useDeleteVehicle } from '@/features/drivers/hooks/useDeleteVehicle'
import { useUpdateVehicle } from '@/features/drivers/hooks/useUpdateVehicle'
import { useDepots } from '@/hooks/useDepots'
import { useDrivers } from '@/hooks/useDrivers'
import { useVehicles } from '@/hooks/useVehicles'
import { parseCapacity, vehicleKindLabel } from '@/lib/driverDefaults'

/** Which row edits in place: none, a new vehicle, or one that exists. */
type Editing = null | 'new' | VehicleId

/** Every vehicle, what it carries, where it starts, and who drives it. Rows edit in place. */
export function VehiclesPage() {
  const vehicles = useVehicles()
  const depots = useDepots()
  const drivers = useDrivers()
  const remove = useDeleteVehicle()
  const [editing, setEditing] = useState<Editing>(null)
  const [deleting, setDeleting] = useState<Vehicle | null>(null)
  const error = vehicles.error ?? depots.error ?? drivers.error
  if (error) return <ErrorNotice error={error} className="m-6" />
  if (!vehicles.data || !depots.data || !drivers.data) return null
  const hasDepot = depots.data.length > 0
  const allDrivers = drivers.data
  const driversOf = (v: Vehicle) => allDrivers.filter((d) => d.vehicleId === v.id)
  return (
    <section className="flex flex-col gap-4 p-4 sm:p-6">
      <HeaderSlot slot="actions">
        <Button disabled={!hasDepot || editing === 'new'} onClick={() => setEditing('new')}>
          <Plus aria-hidden="true" />
          Add vehicle
        </Button>
      </HeaderSlot>
      <p className="text-sm text-muted-foreground">
        {`${vehicles.data.length} vehicle${vehicles.data.length === 1 ? '' : 's'}. Capacity is how many boxes fit on one trip.`}
      </p>
      {!hasDepot && (
        <p role="status" className="rounded-md border bg-card px-3 py-2 text-sm">
          Vehicles start from a depot, so add your depot first.{' '}
          <Link to="/depots/new" className="font-[560] text-brand hover:underline">Add depot</Link>
        </p>
      )}
      <ErrorNotice error={remove.error} />
      <div className="overflow-hidden rounded-lg border bg-card">
        <Table className="min-w-[760px]">
          <TableHeader className="bg-inset">
            <TableRow>
              <TableHead className="w-[28%]">Name</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>Capacity</TableHead>
              <TableHead>Depot</TableHead>
              <TableHead>Driver</TableHead>
              <TableHead className="w-24"><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vehicles.data.map((v) =>
              editing === v.id ? (
                <VehicleEditRow key={v.id} vehicle={v} depots={depots.data} drivers={driversOf(v)} onDone={() => setEditing(null)} />
              ) : (
                <TableRow key={v.id}>
                  <TableCell className="font-[560]">{v.name}</TableCell>
                  <TableCell className="text-[var(--text-2)]">{vehicleKindLabel[v.kind]}</TableCell>
                  <TableCell className="tabular-nums">{`${v.capacity} boxes`}</TableCell>
                  <TableCell className="text-[var(--text-2)]">{depots.data.find((d) => d.id === v.depotId)?.name}</TableCell>
                  <TableCell><DriverLinks drivers={driversOf(v)} /></TableCell>
                  <TableCell>
                    <span className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" aria-label={`Edit ${v.name}`} onClick={() => setEditing(v.id)}>
                        <Pencil aria-hidden="true" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label={`Delete ${v.name}`} onClick={() => { remove.reset(); setDeleting(v) }}>
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </span>
                  </TableCell>
                </TableRow>
              ),
            )}
            {editing === 'new' && <VehicleEditRow vehicle={null} depots={depots.data} drivers={[]} onDone={() => setEditing(null)} />}
            {!vehicles.data.length && editing !== 'new' && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  No vehicles yet. Adding a driver gives them one, or add a vehicle here.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name ?? 'vehicle'}?`}
        description={
          deleting && driversOf(deleting).length
            ? `${driversOf(deleting).map((d) => d.name).join(', ')} will have no vehicle, and draft plans drop their routes. A vehicle on a sent route cannot be deleted.`
            : 'No driver uses this vehicle. This cannot be undone.'
        }
        confirmLabel="Delete vehicle"
        destructive
        pending={remove.isPending}
        onConfirm={() => {
          const v = deleting
          if (!v) return
          remove.mutate(v.id, {
            onSuccess: () => toast.success(`${v.name} deleted`),
            onSettled: () => setDeleting(null),
          })
        }}
      />
    </section>
  )
}

function DriverLinks({ drivers }: { drivers: Driver[] }) {
  if (!drivers.length) return <span className="text-muted-foreground">Nobody</span>
  return (
    <span className="flex flex-wrap gap-x-2">
      {drivers.map((d) => (
        <Link key={d.id} to="/drivers/$driverId" params={{ driverId: d.id }} className="text-brand hover:underline">
          {d.name}
        </Link>
      ))}
    </span>
  )
}

type RowDraft = { name: string; kind: VehicleKind; capacity: string; depotId: string }

function VehicleEditRow({ vehicle, depots, drivers, onDone }: { vehicle: Vehicle | null; depots: Depot[]; drivers: Driver[]; onDone: () => void }) {
  const create = useCreateVehicle()
  const update = useUpdateVehicle()
  const [draft, setDraft] = useState<RowDraft>({
    name: vehicle?.name ?? '',
    kind: vehicle?.kind ?? 'motorbike',
    capacity: String(vehicle?.capacity ?? 10),
    depotId: vehicle?.depotId ?? depots[0]?.id ?? '',
  })
  const [problem, setProblem] = useState<Error | null>(null)
  const set = (patch: Partial<RowDraft>) => setDraft((d) => ({ ...d, ...patch }))
  const depot = depots.find((d) => d.id === draft.depotId)
  const pending = create.isPending || update.isPending
  const save = () => {
    const capacity = parseCapacity(draft.capacity)
    if (!draft.name.trim()) return setProblem(new Error('Give the vehicle a name, such as its plate.'))
    if (capacity === null) return setProblem(new Error('Capacity is a whole number of boxes, 1 or more.'))
    if (!depot) return setProblem(new Error('Pick the depot the vehicle starts from.'))
    setProblem(null)
    const input = { name: draft.name, kind: draft.kind, capacity, depotId: depot.id }
    const done = {
      onSuccess: (v: Vehicle) => {
        toast.success(`${v.name} saved`)
        onDone()
      },
    }
    if (vehicle) update.mutate({ vehicleId: vehicle.id, patch: input }, done)
    else create.mutate(input, done)
  }
  const keys = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      save()
    } else if (e.key === 'Escape') onDone()
  }
  const error = problem ?? create.error ?? update.error
  const depotItems = Object.fromEntries(depots.map((d) => [d.id, d.name]))
  return (
    <>
      <TableRow onKeyDown={keys} className="bg-inset hover:bg-inset">
        <TableCell><Input aria-label="Vehicle name" placeholder="Plate, such as AB 3101 KD" value={draft.name} autoFocus onChange={(e) => set({ name: e.target.value })} className="h-8" /></TableCell>
        <TableCell><VehicleKindSelect label="Kind" value={draft.kind} onChange={(kind) => set({ kind })} className="h-8 w-32" /></TableCell>
        <TableCell><Input aria-label="Capacity" inputMode="numeric" value={draft.capacity} onChange={(e) => set({ capacity: e.target.value })} className="h-8 w-20" /></TableCell>
        <TableCell>
          <Select items={depotItems} value={draft.depotId} onValueChange={(v) => v && set({ depotId: v })}>
            <SelectTrigger aria-label="Depot" size="sm" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {depots.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell><DriverLinks drivers={drivers} /></TableCell>
        <TableCell>
          <span className="flex justify-end gap-1">
            <Button size="icon-sm" aria-label="Save" disabled={pending} onClick={save}>
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
          <TableCell colSpan={6}><ErrorNotice error={error} /></TableCell>
        </TableRow>
      )}
    </>
  )
}
