import { Link, useNavigate } from '@tanstack/react-router'
import { MapPinned } from 'lucide-react'
import { useState } from 'react'
import type { Order, OrderId } from '@/api/types'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { ErrorNotice } from '@/components/ErrorNotice'
import { HeaderSlot } from '@/components/HeaderSlot'
import type { MapStop } from '@/components/RouteMap'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AddressFix } from '@/features/stops/components/AddressFix'
import { PinMap } from '@/features/stops/components/PinMap'
import { CapacityBanner } from '@/features/stops/components/CapacityBanner'
import { useDeleteOrders } from '@/features/stops/hooks/useDeleteOrders'
import { countByStatus, stopStatusLabel, stopStatusOf, stopStatuses, type StopStatus } from '@/features/stops/stopList'
import { useDepots } from '@/hooks/useDepots'
import { useOrders } from '@/hooks/useOrders'

type Tab = StopStatus | 'all'
const tabLabel: Record<Tab, string> = { all: 'All', ...stopStatusLabel }
const dotClass: Record<StopStatus, string> = { ready: 'bg-brand', check: 'bg-[var(--warning)]', not_found: 'bg-[var(--danger)]' }

const reasonOf = (o: Order) => (o.geocode.status === 'check' ? o.geocode.reason : o.geocode.status === 'not_found' ? 'not found, skip or fix' : null)

/** Step 3 of the import: check the load against the fleet and fix each address the map could not place for sure. */
export function ImportReviewPage() {
  const navigate = useNavigate()
  const { data: orders, error } = useOrders()
  const { data: depots } = useDepots()
  const skip = useDeleteOrders()
  const [tab, setTab] = useState<Tab | null>(null)
  const [selectedId, setSelectedId] = useState<OrderId | null>(null)
  const [pinFor, setPinFor] = useState<OrderId | null>(null)
  const [confirmSkip, setConfirmSkip] = useState(false)

  if (!orders) {
    return <section className="p-6">{error ? <ErrorNotice error={error} /> : <Skeleton className="h-64" />}</section>
  }
  if (!orders.length) {
    return (
      <EmptyState icon={MapPinned} title="No stops to review">
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">Import a spreadsheet of stops first. This screen then shows the addresses to check.</p>
        <Button className="mt-6" nativeButton={false} render={<Link to="/stops/import" />}>
          Import stops
        </Button>
      </EmptyState>
    )
  }

  const counts = countByStatus(orders)
  const activeTab: Tab = tab ?? (counts.check ? 'check' : counts.not_found ? 'not_found' : 'all')
  const shown = activeTab === 'all' ? orders : orders.filter((o) => stopStatusOf(o.geocode) === activeTab)
  const needsFix = activeTab === 'check' || activeTab === 'not_found'
  const selected = shown.find((o) => o.id === selectedId) ?? (needsFix ? shown[0] : undefined)
  const unplaced = orders.filter((o) => o.geocode.status === 'not_found')
  const placed = orders.length - unplaced.length
  const mapStops: MapStop[] = orders.flatMap((o) =>
    o.geocode.status === 'not_found' ? [] : [{ id: o.id, location: o.geocode.location, label: o.customer, color: null, warning: o.geocode.status === 'check' }],
  )
  const select = (id: OrderId) => {
    setSelectedId(id)
    setPinFor(null)
  }
  const goPlan = () => navigate({ to: '/routes/new' })
  const save = () => (unplaced.length ? setConfirmSkip(true) : goPlan())

  return (
    <div className="flex min-h-0 flex-1 max-lg:flex-col">
      <HeaderSlot slot="actions">
        <Button size="sm" onClick={save} disabled={placed === 0}>{`Save ${placed} stops`}</Button>
      </HeaderSlot>
      <section className="flex min-h-0 flex-col gap-3 overflow-y-auto p-4 lg:w-[480px] lg:shrink-0 lg:border-r">
        <CapacityBanner orders={orders} />
        <ErrorNotice error={skip.error} />
        <div role="group" aria-label="Show stops" className="flex flex-wrap gap-2">
          {(['all', ...stopStatuses] as const).map((t) => (
            <Button
              key={t}
              size="sm"
              variant={t === activeTab ? 'default' : 'outline'}
              aria-pressed={t === activeTab}
              onClick={() => {
                setTab(t)
                setPinFor(null)
              }}
            >
              {`${tabLabel[t]} ${t === 'all' ? orders.length : counts[t]}`}
            </Button>
          ))}
        </div>
        {shown.length === 0 ? (
          <p className="rounded-lg border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
            {activeTab === 'ready' ? 'No stop is on the map yet.' : `No stops left under ${tabLabel[activeTab]}.`}
          </p>
        ) : (
          <ul aria-label="Stops" className="overflow-hidden rounded-lg border bg-card">
            {shown.map((o) => {
              const status = stopStatusOf(o.geocode)
              const open = o.id === selected?.id
              return (
                <li key={o.id} className={`border-b last:border-b-0 ${open ? 'bg-brand-soft/40 outline-1 -outline-offset-1 outline-ring' : ''}`}>
                  <button type="button" aria-expanded={open} onClick={() => (open ? setSelectedId(null) : select(o.id))} className="flex w-full min-w-0 items-center gap-2 px-4 py-3 text-left text-sm">
                    <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${dotClass[status]}`} />
                    <span className="shrink-0 font-[560]">{o.customer}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {o.addressRaw}
                      {reasonOf(o) && ` · ${reasonOf(o)}`}
                    </span>
                  </button>
                  {open && (
                    <div className="px-4 pb-4">
                      <AddressFix key={o.id + o.addressRaw} order={o} pinning={pinFor === o.id} onPinningChange={(on) => setPinFor(on ? o.id : null)} />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
      <PinMap
        stops={mapStops}
        depot={depots?.[0]?.location ?? null}
        selectedId={selected?.id ?? null}
        pinFor={pinFor ? (orders.find((o) => o.id === pinFor) ?? null) : null}
        onSelect={select}
        onPinned={() => setPinFor(null)}
      />
      <ConfirmDialog
        open={confirmSkip}
        onOpenChange={setConfirmSkip}
        title={`Skip ${unplaced.length === 1 ? '1 stop' : `${unplaced.length} stops`} without a location?`}
        description={`${unplaced.map((o) => o.customer).join(', ')} could not be placed on the map, so no route can reach ${unplaced.length === 1 ? 'it' : 'them'}. Skipping deletes ${unplaced.length === 1 ? 'it' : 'them'}. Cancel to fix the address instead.`}
        confirmLabel={`Skip and save ${placed} stops`}
        destructive
        pending={skip.isPending}
        onConfirm={() => skip.mutate(unplaced.map((o) => o.id), { onSuccess: () => void goPlan() })}
      />
    </div>
  )
}
