import { Link, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { ErrorNotice } from '@/components/ErrorNotice'
import { Button } from '@/components/ui/button'
import { DriverForm } from '@/features/drivers/components/DriverForm'
import { useCreateFleetDrivers } from '@/features/drivers/hooks/useCreateFleetDrivers'
import { useDrivers } from '@/hooks/useDrivers'
import { useVehicles } from '@/hooks/useVehicles'
import { deriveDefaults } from '@/lib/driverDefaults'

/** Adds one driver. It starts from the defaults most drivers share. */
export function NewDriverPage() {
  const drivers = useDrivers()
  const vehicles = useVehicles()
  const create = useCreateFleetDrivers()
  const navigate = useNavigate()
  const error = drivers.error ?? vehicles.error
  if (error) return <ErrorNotice error={error} className="m-6" />
  if (!drivers.data || !vehicles.data) return null
  return (
    <DriverForm
      heading="New driver"
      driver={null}
      vehicles={vehicles.data}
      defaults={deriveDefaults(drivers.data, vehicles.data)}
      submitLabel="Save driver"
      pending={create.isPending}
      error={create.error}
      onSubmit={(input) =>
        create.mutate([input], {
          onSuccess: ([driver]) => {
            toast.success(`${driver.name} added`)
            void navigate({ to: '/drivers' })
          },
        })
      }
      secondary={
        <Button variant="outline" nativeButton={false} render={<Link to="/drivers" />}>
          Back
        </Button>
      }
    />
  )
}
