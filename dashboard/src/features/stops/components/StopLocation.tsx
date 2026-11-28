import { Link } from '@tanstack/react-router'
import type { Order } from '@/api/types'
import { RouteMap } from '@/components/RouteMap'
import { Badge } from '@/components/ui/badge'
import { stopStatusLabel, stopStatusOf, type StopStatus } from '@/features/stops/stopList'

const tone: Record<StopStatus, string> = { ready: 'var(--success)', check: 'var(--warning)', not_found: 'var(--danger)' }

/** Where the stop's address landed on the map, and a way to fix it when it needs a check. */
export function StopLocation({ order }: { order: Order }) {
  const { geocode } = order
  const status = stopStatusOf(geocode)
  return (
    <aside aria-label="Location" className="grid content-start gap-3 rounded-lg border bg-card p-4 text-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">Location</h3>
        <StopStatusBadge status={status} />
      </div>
      {geocode.status === 'not_found' ? (
        <p className="text-muted-foreground">{`"${order.addressRaw}" is not on the map. Edit the address, or place a pin in the review.`}</p>
      ) : (
        <>
          <p data-testid="geocoded-address">{geocode.address}</p>
          {geocode.status === 'check' && <p className="text-muted-foreground">{`Best guess: ${geocode.reason}.`}</p>}
          {geocode.status === 'manual' && <p className="text-muted-foreground">Pin placed by hand.</p>}
          <RouteMap
            label={`Map of ${order.customer}`}
            depot={null}
            stops={[{ id: order.id, location: geocode.location, label: order.customer, color: null, warning: geocode.status === 'check' }]}
            className="h-48 rounded-md"
          />
        </>
      )}
      {status !== 'ready' && (
        <Link to="/stops/review" className="text-brand">
          Fix in review
        </Link>
      )}
    </aside>
  )
}

export function StopStatusBadge({ status }: { status: StopStatus }) {
  return (
    <Badge variant="outline" className="gap-1.5">
      <span aria-hidden="true" className="size-1.5 rounded-full" style={{ background: tone[status] }} />
      {stopStatusLabel[status]}
    </Badge>
  )
}
