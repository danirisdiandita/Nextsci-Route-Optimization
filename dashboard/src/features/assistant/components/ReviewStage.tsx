import { Link } from '@tanstack/react-router'
import type { Day, Depot } from '@/api/types'
import { RouteMap, type MapStop } from '@/components/RouteMap'
import type { OrderReview } from '@/features/assistant/api'
import { AskButton, Panel, StageColumn, StageHeading, ToneBadge } from '@/features/assistant/components/TodayParts'
import { useOrders } from '@/hooks/useOrders'
import { orderLocation } from '@/lib/route'
import { formatDay } from '@/lib/time'

/** Design NS 03: the orders the agent read, what it fixed, and what still needs the dispatcher. */
export function ReviewStage({ review, day, depot }: { review: OrderReview; day: Day; depot: Depot | null }) {
  const { data: orders } = useOrders()
  const doubted = new Set([...review.fixed, ...review.check].map((r) => r.order.id))
  // Every placed order is a dot. The ones the agent placed get a warning ring, so the dispatcher can check them.
  const stops: MapStop[] = (orders ?? []).flatMap((o) => {
    const location = orderLocation(o)
    return location ? [{ id: o.id, location, label: o.customer, color: doubted.has(o.id) ? null : (1 as const), warning: doubted.has(o.id) }] : []
  })
  const rows = [
    ...review.needsYou.map((r) => ({ ...r, needsYou: true })),
    ...[...review.check, ...review.fixed].map((r) => ({ ...r, needsYou: false })),
  ]
  return (
    <StageColumn>
      <StageHeading
        title={`${review.total} orders for ${formatDay(day)}`}
        aside={
          <div className="flex flex-wrap gap-1.5">
            <ToneBadge tone="success">{`${review.ready} ready`}</ToneBadge>
            {doubted.size > 0 && <ToneBadge tone="warning">{`${doubted.size} fixed`}</ToneBadge>}
            {review.needsYou.length > 0 && <ToneBadge tone="danger">{`${review.needsYou.length} needs you`}</ToneBadge>}
          </div>
        }
      />
      <RouteMap label={`Map of ${stops.length} orders`} depot={depot?.location ?? null} stops={stops} className="h-72 rounded-xl border" />
      <h3 className="pt-2 text-sm font-[560]">What the agent changed</h3>
      <Panel className="p-0">
        <ul className="divide-y text-sm">
          {rows.map((r) => (
            <li key={r.order.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(140px,180px)_1fr_auto] sm:items-center">
              <Link to="/stops/$orderId" params={{ orderId: r.order.id }} className="flex min-w-0 items-center gap-2 font-[560] text-foreground hover:underline">
                <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: r.needsYou ? 'var(--danger)' : 'var(--warning)' }} />
                <span className="truncate">{r.order.customer}</span>
              </Link>
              <p className={`text-xs ${r.needsYou ? 'text-[var(--danger-text)]' : 'text-muted-foreground'}`}>{r.note}</p>
              {r.needsYou ? (
                <div className="flex gap-1.5">
                  <AskButton variant="outline" size="sm" say={`Skip ${r.order.customer} today`}>
                    Skip it today
                  </AskButton>
                  <AskButton variant="ghost" size="sm" className="text-brand" say={`Pin ${r.order.customer} on the map`}>
                    Resolve
                  </AskButton>
                </div>
              ) : (
                <span />
              )}
            </li>
          ))}
        </ul>
      </Panel>
    </StageColumn>
  )
}
