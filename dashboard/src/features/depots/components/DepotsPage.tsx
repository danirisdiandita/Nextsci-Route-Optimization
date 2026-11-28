import { Link, useNavigate } from '@tanstack/react-router'
import { Plus, Warehouse } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { ErrorNotice } from '@/components/ErrorNotice'
import { HeaderSlot } from '@/components/HeaderSlot'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useDepots } from '@/hooks/useDepots'
import { useVehicles } from '@/hooks/useVehicles'
import { formatWindow } from '@/lib/time'

/** Every depot, with where it is, when it opens, and how many vehicles start there. */
export function DepotsPage() {
  const { data: depots, error } = useDepots()
  const { data: vehicles = [] } = useVehicles()
  const navigate = useNavigate()
  const newDepot = (
    <Button nativeButton={false} render={<Link to="/depots/new" />}>
      <Plus aria-hidden="true" />
      New depot
    </Button>
  )
  if (error) return <ErrorNotice error={error} className="m-6" />
  if (!depots) return null
  if (!depots.length) {
    return (
      <EmptyState icon={Warehouse} title="No depots yet">
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">A depot is where routes start and end, such as your kitchen or warehouse.</p>
        <div className="mt-6">{newDepot}</div>
      </EmptyState>
    )
  }
  return (
    <section className="p-6">
      <HeaderSlot slot="actions">{newDepot}</HeaderSlot>
      <p className="text-sm text-muted-foreground">{`${depots.length} depot${depots.length === 1 ? '' : 's'}`}</p>
      <div className="mt-4 overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader className="bg-inset">
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Opening hours</TableHead>
              <TableHead>Loading</TableHead>
              <TableHead className="text-right">Vehicles</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {depots.map((d) => (
              <TableRow key={d.id} className="cursor-pointer" onClick={() => void navigate({ to: '/depots/$depotId', params: { depotId: d.id } })}>
                <TableCell className="font-[560]">
                  <Link to="/depots/$depotId" params={{ depotId: d.id }} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                    {d.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{d.address}</TableCell>
                <TableCell className="tabular-nums">{formatWindow(d.hours)}</TableCell>
                <TableCell className="tabular-nums">{`${d.loadMinutes} min`}</TableCell>
                <TableCell className="text-right tabular-nums">{vehicles.filter((v) => v.depotId === d.id).length}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}
