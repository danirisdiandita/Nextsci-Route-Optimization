import { useVehicles } from '@/hooks/useVehicles'

// Placeholder: the drivers feature replaces this with the vehicle list.
export function VehiclesPage() {
  const { data: vehicles } = useVehicles()
  return (
    <section className="p-6">
      <h2 className="text-xl font-semibold">Vehicles</h2>
      <p className="mt-1 text-muted-foreground">{vehicles ? `${vehicles.length} vehicles` : 'Loading vehicles'}</p>
    </section>
  )
}
