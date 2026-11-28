import { Link, useNavigate } from '@tanstack/react-router'
import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import type { DriverId } from '@/api/types'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ErrorNotice } from '@/components/ErrorNotice'
import { Button } from '@/components/ui/button'
import { DriverForm } from '@/features/drivers/components/DriverForm'
import { useDeleteDriver } from '@/features/drivers/hooks/useDeleteDriver'
import { useDriver } from '@/features/drivers/hooks/useDriver'
import { useUpdateFleetDriver } from '@/features/drivers/hooks/useUpdateFleetDriver'
import { useDrivers } from '@/hooks/useDrivers'
import { useVehicles } from '@/hooks/useVehicles'
import { deriveDefaults } from '@/lib/driverDefaults'

/** Edits a driver, or deletes them when no sent route depends on them. */
export function DriverPage({ driverId }: { driverId: DriverId }) {
  const driver = useDriver(driverId)
  const drivers = useDrivers()
  const vehicles = useVehicles()
  const update = useUpdateFleetDriver()
  const remove = useDeleteDriver()
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)
  const error = driver.error ?? drivers.error ?? vehicles.error
  if (error) {
    return (
      <section className="grid gap-4 p-6">
        <ErrorNotice error={error} />
        <Link to="/drivers" className="text-sm text-brand">Back to drivers</Link>
      </section>
    )
  }
  if (!driver.data || !drivers.data || !vehicles.data) return null
  const d = driver.data
  return (
    <>
      <DriverForm
        key={d.id}
        heading={d.name}
        driver={d}
        vehicles={vehicles.data}
        defaults={deriveDefaults(drivers.data, vehicles.data)}
        submitLabel="Save changes"
        pending={update.isPending}
        error={update.error ?? remove.error}
        onSubmit={(patch) => update.mutate({ driverId, patch }, { onSuccess: (saved) => toast.success(`${saved.name} saved`) })}
        secondary={
          <>
            <Button variant="outline" nativeButton={false} render={<Link to="/drivers" />}>
              Back
            </Button>
            <Button variant="outline" className="text-destructive" onClick={() => { remove.reset(); setConfirming(true) }}>
              <Trash2 aria-hidden="true" />
              Delete
            </Button>
          </>
        }
      />
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Delete ${d.name}?`}
        description="Draft plans spread this driver's stops over the other drivers. A driver with a route that was already sent cannot be deleted. Their vehicle stays."
        confirmLabel="Delete driver"
        destructive
        pending={remove.isPending}
        onConfirm={() =>
          remove.mutate(driverId, {
            onSuccess: () => {
              toast.success(`${d.name} deleted`)
              void navigate({ to: '/drivers' })
            },
            onSettled: () => setConfirming(false),
          })
        }
      />
    </>
  )
}
