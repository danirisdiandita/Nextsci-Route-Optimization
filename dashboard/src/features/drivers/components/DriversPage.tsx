import { Link } from '@tanstack/react-router'
import { useDrivers } from '@/hooks/useDrivers'
import { useVehicles } from '@/hooks/useVehicles'

// Placeholder: the drivers feature replaces this with the drivers table and shared defaults (design NM 03).
export function DriversPage() {
  const { data: drivers } = useDrivers()
  const { data: vehicles } = useVehicles()
  return (
    <section className="p-6">
      <h2 className="text-xl font-semibold">Who drives, and what do they carry?</h2>
      <p className="mt-1 text-muted-foreground">{drivers && vehicles ? `${drivers.length} drivers, ${vehicles.length} vehicles` : 'Loading drivers'}</p>
      <ul className="mt-4 grid gap-1">
        {drivers?.map((d) => (
          <li key={d.id}>
            <Link to="/drivers/$driverId" params={{ driverId: d.id }} className="text-brand">
              {d.name}
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-4 flex gap-4">
        <Link to="/drivers/new" className="text-brand">Add driver</Link>
        <Link to="/drivers/vehicles" className="text-brand">Vehicles</Link>
      </p>
    </section>
  )
}
