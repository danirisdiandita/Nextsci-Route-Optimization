import { Link, useNavigate } from '@tanstack/react-router'
import { MapPinned, Plus, Search, Upload } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import type { OrderId } from '@/api/types'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { ErrorNotice } from '@/components/ErrorNotice'
import { HeaderSlot } from '@/components/HeaderSlot'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { StopStatusBadge } from '@/features/stops/components/StopLocation'
import { useDeleteOrders } from '@/features/stops/hooks/useDeleteOrders'
import { countByStatus, filterStops, stopStatusLabel, stopStatusOf, stopStatuses, type StopFilter, type WindowFilter } from '@/features/stops/stopList'
import { useOrders } from '@/hooks/useOrders'
import { formatWindow } from '@/lib/time'

const statusItems = [{ value: 'all', label: 'All statuses' }, ...stopStatuses.map((s) => ({ value: s, label: stopStatusLabel[s] }))]
const windowItems: { value: WindowFilter; label: string }[] = [
  { value: 'all', label: 'Any window' },
  { value: 'with', label: 'Has a time window' },
  { value: 'without', label: 'No time window' },
]

/** Every stop, searchable and filterable, with bulk delete. A row opens the stop. */
export function StopsPage() {
  const navigate = useNavigate()
  const { data: orders, error } = useOrders()
  const remove = useDeleteOrders()
  const [filter, setFilter] = useState<StopFilter>({ text: '', status: 'all', window: 'all' })
  const [picked, setPicked] = useState<ReadonlySet<OrderId>>(new Set())
  const [confirmDelete, setConfirmDelete] = useState(false)

  const actions = (
    <HeaderSlot slot="actions">
      <Button variant="outline" size="sm" nativeButton={false} render={<Link to="/stops/import" />}>
        <Upload data-icon="inline-start" />
        <span className="max-sm:sr-only">Import CSV</span>
      </Button>
      <Button size="sm" nativeButton={false} render={<Link to="/stops/new" />}>
        <Plus data-icon="inline-start" />
        <span className="max-sm:sr-only">Add stop</span>
      </Button>
    </HeaderSlot>
  )

  if (!orders) {
    return (
      <section className="p-4 sm:p-6">
        {actions}
        {error ? <ErrorNotice error={error} /> : <Skeleton className="h-96" />}
      </section>
    )
  }
  if (!orders.length) {
    return (
      <EmptyState icon={MapPinned} title="No stops yet">
        {actions}
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">Import the spreadsheet of today's orders, or add a stop by hand.</p>
        <div className="mt-6 flex gap-2">
          <Button nativeButton={false} render={<Link to="/stops/import" />}>
            Import stops
          </Button>
          <Button variant="outline" nativeButton={false} render={<Link to="/stops/new" />}>
            Add stop
          </Button>
        </div>
      </EmptyState>
    )
  }

  const shown = filterStops(orders, filter)
  const counts = countByStatus(orders)
  const toFix = counts.check + counts.not_found
  const selected = shown.filter((o) => picked.has(o.id))
  const allPicked = shown.length > 0 && selected.length === shown.length
  const toggle = (id: OrderId, on: boolean) =>
    setPicked((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  const deleteSelected = () =>
    remove.mutate(
      selected.map((o) => o.id),
      {
        onSuccess: () => {
          toast.success(`Deleted ${selected.length === 1 ? '1 stop' : `${selected.length} stops`}`)
          setPicked(new Set())
          setConfirmDelete(false)
        },
        onError: () => setConfirmDelete(false),
      },
    )

  return (
    <section className="flex flex-col gap-4 p-4 sm:p-6">
      {actions}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.012em]">Stops</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {`${orders.length} stops · ${counts.ready} ready`}
            {toFix > 0 && ` · ${toFix} need an address check`}
          </p>
        </div>
        {toFix > 0 && (
          <Button variant="secondary" size="sm" nativeButton={false} render={<Link to="/stops/review" />}>
            Review addresses
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-60">
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            aria-label="Search stops"
            placeholder="Search name, address, phone, notes"
            value={filter.text}
            onChange={(e) => setFilter((f) => ({ ...f, text: e.target.value }))}
            className="pl-9"
          />
        </div>
        <Select items={statusItems} value={filter.status} onValueChange={(v) => setFilter((f) => ({ ...f, status: (v ?? 'all') as StopFilter['status'] }))}>
          <SelectTrigger aria-label="Address status" className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statusItems.map((i) => (
              <SelectItem key={i.value} value={i.value}>
                {i.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select items={windowItems} value={filter.window} onValueChange={(v) => setFilter((f) => ({ ...f, window: v ?? 'all' }))}>
          <SelectTrigger aria-label="Time window" className="w-[176px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {windowItems.map((i) => (
              <SelectItem key={i.value} value={i.value}>
                {i.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selected.length > 0 && (
        <div role="status" className="flex items-center justify-between gap-2 rounded-lg border bg-card px-4 py-2 text-sm">
          <span>{`${selected.length} selected`}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setPicked(new Set())}>
              Clear
            </Button>
            <Button size="sm" variant="destructive" onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          </div>
        </div>
      )}
      <ErrorNotice error={remove.error} />

      <div className="overflow-x-auto rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  aria-label="Select all shown stops"
                  checked={allPicked}
                  indeterminate={selected.length > 0 && !allPicked}
                  onCheckedChange={(on) => setPicked(on ? new Set(shown.map((o) => o.id)) : new Set())}
                />
              </TableHead>
              <TableHead>Customer</TableHead>
              <TableHead className="max-md:hidden">Address</TableHead>
              <TableHead>Window</TableHead>
              <TableHead className="text-right">Load</TableHead>
              <TableHead className="max-sm:hidden">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((o) => (
              <TableRow
                key={o.id}
                data-state={picked.has(o.id) ? 'selected' : undefined}
                className="cursor-pointer"
                onClick={() => void navigate({ to: '/stops/$orderId', params: { orderId: o.id } })}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox aria-label={`Select ${o.customer}`} checked={picked.has(o.id)} onCheckedChange={(on) => toggle(o.id, on)} />
                </TableCell>
                <TableCell className="font-[560]">
                  <Link to="/stops/$orderId" params={{ orderId: o.id }} onClick={(e) => e.stopPropagation()}>
                    {o.customer}
                  </Link>
                </TableCell>
                <TableCell className="max-w-[320px] truncate text-muted-foreground max-md:hidden">{o.addressRaw}</TableCell>
                <TableCell className="tabular-nums">{o.window ? formatWindow(o.window) : <span className="text-muted-foreground">Any time</span>}</TableCell>
                <TableCell className="text-right tabular-nums">{o.quantity}</TableCell>
                <TableCell className="max-sm:hidden">
                  <StopStatusBadge status={stopStatusOf(o.geocode)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {shown.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted-foreground">No stops match these filters.</p>}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${selected.length === 1 ? '1 stop' : `${selected.length} stops`}?`}
        description="They leave the stop list and any draft plan. Nothing is deleted if one of them is on a route already sent to a driver."
        confirmLabel="Delete"
        destructive
        pending={remove.isPending}
        onConfirm={deleteSelected}
      />
    </section>
  )
}
