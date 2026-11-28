import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowRight, Plus, Truck, Upload, UsersRound } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import type { Driver, Vehicle, Workspace } from '@/api/types'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ErrorNotice } from '@/components/ErrorNotice'
import { Button } from '@/components/ui/button'
import { AddDriversDialog } from '@/features/drivers/components/AddDriversDialog'
import { DefaultsBar } from '@/features/drivers/components/DefaultsBar'
import { DriversTable } from '@/features/drivers/components/DriversTable'
import { useApplyDriverDefaults } from '@/features/drivers/hooks/useApplyDriverDefaults'
import { useDrivers } from '@/hooks/useDrivers'
import { useVehicles } from '@/hooks/useVehicles'
import { useWorkspace } from '@/hooks/useWorkspace'
import {
  deriveDefaults,
  differences,
  draftOfDefaults,
  formatBreak,
  parseDefaultsDraft,
  vehicleKindLabel,
  vehicleOf,
  type DefaultsDraft,
  type DefaultsErrors,
} from '@/lib/driverDefaults'
import { nextSetupStep } from '@/lib/setupSteps'
import { formatWindow } from '@/lib/time'

/** Setup step 2, and the drivers screen after setup (design NM 03). */
export function DriversPage() {
  const drivers = useDrivers()
  const vehicles = useVehicles()
  const workspace = useWorkspace()
  const error = drivers.error ?? vehicles.error ?? workspace.error
  if (error) return <ErrorNotice error={error} className="m-6" />
  if (!drivers.data || !vehicles.data || !workspace.data) return null
  return <DriversBody drivers={drivers.data} vehicles={vehicles.data} workspace={workspace.data} />
}

function DriversBody({ drivers, vehicles, workspace }: { drivers: Driver[]; vehicles: Vehicle[]; workspace: Workspace }) {
  const [draft, setDraft] = useState<DefaultsDraft>(() => draftOfDefaults(deriveDefaults(drivers, vehicles)))
  const [errors, setErrors] = useState<DefaultsErrors>({})
  const [adding, setAdding] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const apply = useApplyDriverDefaults()
  const navigate = useNavigate()
  const parsed = parseDefaultsDraft(draft)
  // While the bar holds a typo, compare rows with the last defaults that parse: what most drivers share.
  const defaults = 'defaults' in parsed ? parsed.defaults : deriveDefaults(drivers, vehicles)
  const changing = drivers.filter((d) => differences(d, vehicleOf(d, vehicles), defaults).size > 0)
  const hasDepot = workspace.counts.depots > 0
  const inSetup = !!nextSetupStep(workspace.setup)
  const next = nextSetupStep({ ...workspace.setup, drivers: drivers.length > 0 })

  const requestApply = () => {
    if ('errors' in parsed) return setErrors(parsed.errors)
    setErrors({})
    if (!changing.length) return void toast.success('Every driver already has these defaults')
    setConfirming(true)
  }
  const confirmApply = () =>
    apply.mutate(
      { driverIds: drivers.map((d) => d.id), defaults },
      {
        onSuccess: () => toast.success(`Applied the defaults to ${drivers.length} drivers`),
        onSettled: () => setConfirming(false),
      },
    )

  return (
    <section className="flex flex-1 flex-col gap-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.012em]">Who drives, and what do they carry?</h2>
          <p className="mt-1 text-sm text-muted-foreground">Set defaults once, then change any driver who differs.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" nativeButton={false} render={<Link to="/drivers/vehicles" />}>
            <Truck aria-hidden="true" />
            Vehicles
          </Button>
          <Button variant="outline" disabled={!hasDepot} onClick={() => setAdding(true)}>
            <Upload aria-hidden="true" />
            Import CSV
          </Button>
          <Button variant="outline" disabled={!hasDepot} nativeButton={false} render={<Link to="/drivers/new" />}>
            <Plus aria-hidden="true" />
            Add driver
          </Button>
        </div>
      </div>

      {!hasDepot && (
        <p role="status" className="rounded-md border bg-card px-3 py-2 text-sm">
          Vehicles start from a depot, so add your depot first.{' '}
          <Link to="/depots/new" className="font-[560] text-brand hover:underline">Add depot</Link>
        </p>
      )}

      <DefaultsBar
        draft={draft}
        errors={errors}
        onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
        driverCount={drivers.length}
        pending={apply.isPending}
        onApply={requestApply}
      />
      <ErrorNotice error={apply.error} />

      {drivers.length ? (
        <>
          <DriversTable drivers={drivers} vehicles={vehicles} defaults={defaults} />
          <p className="-mt-2 text-xs text-muted-foreground">
            Rows in bold differ from the defaults. Drivers sign in with their phone number; no app account needed yet.
          </p>
        </>
      ) : (
        <div className="flex flex-col items-center rounded-lg border border-dashed px-6 py-10 text-center">
          <UsersRound aria-hidden="true" className="size-5 text-muted-foreground" />
          <h3 className="mt-3 font-[560]">No drivers yet</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">Paste your drivers from a spreadsheet, or add them one at a time. Each one gets the defaults above.</p>
          <Button className="mt-4" disabled={!hasDepot} onClick={() => setAdding(true)}>
            <Plus aria-hidden="true" />
            Add several drivers
          </Button>
        </div>
      )}

      {inSetup && (
        <div className="mt-auto flex items-center justify-between gap-2 pt-4">
          <Button variant="outline" nativeButton={false} render={<Link to="/onboarding" />}>
            Back
          </Button>
          {drivers.length > 0 && (
            <Button onClick={() => void navigate({ to: next?.to ?? '/onboarding' })}>
              {`Continue with ${drivers.length} driver${drivers.length === 1 ? '' : 's'}`}
              <ArrowRight aria-hidden="true" />
            </Button>
          )}
        </div>
      )}

      <AddDriversDialog open={adding} onOpenChange={setAdding} defaults={defaults} />
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Apply the defaults to all ${drivers.length} drivers?`}
        description={`${changing.map((d) => d.name).slice(0, 3).join(', ')}${changing.length > 3 ? ` and ${changing.length - 3} more` : ''} will change to ${formatWindow(defaults.shift)}, ${formatBreak(defaults.break).toLowerCase()}, and a ${vehicleKindLabel[defaults.vehicle.kind].toLowerCase()} for ${defaults.vehicle.capacity} boxes.`}
        confirmLabel={`Apply to all ${drivers.length}`}
        pending={apply.isPending}
        onConfirm={confirmApply}
      />
    </section>
  )
}
