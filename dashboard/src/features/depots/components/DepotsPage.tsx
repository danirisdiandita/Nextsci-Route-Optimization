import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { useDepots } from '@/hooks/useDepots'

// Placeholder: the depots feature replaces this with the depot list.
export function DepotsPage() {
  const { data: depots } = useDepots()
  return (
    <section className="p-6">
      <h2 className="text-xl font-semibold">Depots</h2>
      <p className="mt-1 text-muted-foreground">{depots ? `${depots.length} depots` : 'Loading depots'}</p>
      <ul className="mt-4 grid gap-1">
        {depots?.map((d) => (
          <li key={d.id}>
            <Link to="/depots/$depotId" params={{ depotId: d.id }} className="text-brand">
              {d.name}
            </Link>
          </li>
        ))}
      </ul>
      <Button className="mt-4" nativeButton={false} render={<Link to="/depots/new" />}>
        New depot
      </Button>
    </section>
  )
}
