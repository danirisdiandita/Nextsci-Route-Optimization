import type { DriverId } from '@/api/types'
import { ErrorNotice } from '@/components/ErrorNotice'
import { useDriver } from '@/features/drivers/hooks/useDriver'

// Placeholder: the drivers feature replaces this with the driver edit form.
export function DriverPage({ driverId }: { driverId: DriverId }) {
  const { data: driver, error } = useDriver(driverId)
  return (
    <section className="p-6">
      <h2 className="text-xl font-semibold">{driver?.name ?? 'Driver'}</h2>
      <p className="mt-1 text-muted-foreground">{driver?.phone}</p>
      <ErrorNotice error={error} className="mt-4" />
    </section>
  )
}
