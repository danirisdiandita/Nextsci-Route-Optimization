import { Link } from '@tanstack/react-router'
import { Pause, Play } from 'lucide-react'
import type { AgentMessage, Depot, LatLng, Order, PlanChange, Route } from '@/api/types'
import { RouteMap, type MapDriver } from '@/components/RouteMap'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { routeProgress, type RouteProgress, type TodayStage } from '@/features/assistant/api'
import { MessageBlockView } from '@/features/assistant/components/AgentMessages'
import { messageBlocks } from '@/features/assistant/messageText'
import { AskButton, Panel, StageActions, StageColumn, StageHeading } from '@/features/assistant/components/TodayParts'
import { useAgentMessages } from '@/features/assistant/hooks/useAgentMessages'
import { useDayWatcher } from '@/features/assistant/hooks/useDayWatcher'
import { useDayClock } from '@/hooks/useDayClock'
import { useDrivers } from '@/hooks/useDrivers'
import { useOrders } from '@/hooks/useOrders'
import { useSetDayClock } from '@/hooks/useSetDayClock'
import { useSimulatedMinute } from '@/hooks/useSimulatedMinute'
import { orderLocation, routePaths } from '@/lib/route'
import { formatMinute } from '@/lib/time'

const speeds = [10, 30, 60]

/** Design NS 08: the live day on the simulated clock, with the agent watching and asking when a change matters. */
export function LiveStage({ stage, depot }: { stage: Extract<TodayStage, { kind: 'live' }>; depot: Depot | null }) {
  useDayWatcher(stage.incidents)
  const minute = useSimulatedMinute()
  const { data: drivers } = useDrivers()
  const { data: orders } = useOrders()
  const { data: messages } = useAgentMessages()
  if (minute === null || !drivers || !orders || !depot) return null
  const { view, proposal, incidents } = stage
  const progress = view.routes.map((r) => ({ route: r, progress: routeProgress(r, incidents, minute) }))
  const delivered = progress.reduce((n, p) => n + p.progress.done, 0)
  const total = progress.reduce((n, p) => n + p.progress.total, 0)
  const onRoad = progress.filter((p) => !['not_started', 'finished'].includes(p.progress.activity.kind)).length
  const byId = new Map(orders.map((o) => [o.id, o]))
  const positions: MapDriver[] = progress.map(({ route, progress: p }) => ({
    id: route.driverId,
    location: positionOf(route, p, byId, depot.location),
    label: `${drivers.find((d) => d.id === route.driverId)?.name ?? 'Driver'} · ${p.done} of ${p.total} done`,
    color: route.color,
    alert: p.delayMinutes > 0,
  }))
  return (
    <StageColumn>
      <StageHeading
        title={
          <span className="flex items-center gap-2">
            <span aria-hidden="true" className="size-2 rounded-full bg-[var(--success)]" />
            {`Live · ${formatMinute(minute)}`}
          </span>
        }
        aside={<p className="text-xs text-muted-foreground">{`${delivered} / ${total} delivered · ${onRoad} driver${onRoad === 1 ? '' : 's'} on the road`}</p>}
      />
      <ClockControls />
      <RouteMap
        label={`Live map of ${view.routes.length} routes at ${formatMinute(minute)}`}
        depot={depot.location}
        routes={view.routes.map((r) => ({ id: r.id, color: r.color, paths: routePaths(r, byId, depot.location), muted: true }))}
        drivers={positions}
        className="h-80 rounded-xl border"
      />
      {proposal ? (
        <>
          <h3 className="pt-2 text-sm font-[560]">Needs a decision</h3>
          <DecisionCard proposal={proposal} message={messages?.find((m) => m.proposalId === proposal.id) ?? null} />
        </>
      ) : (
        <p className="text-sm text-muted-foreground">The agent is watching the routes. When someone falls behind, it says so here and in the panel.</p>
      )}
      <Link to="/routes/live" className="text-sm text-brand hover:underline">
        Open the live view
      </Link>
    </StageColumn>
  )
}

/** Where a driver is now: at a stop, partway to the next one, or at the depot. */
function positionOf(route: Route, p: RouteProgress, orders: Map<string, Order>, depot: LatLng): LatLng {
  const at = (orderId: string) => {
    const o = orders.get(orderId)
    return (o && orderLocation(o)) ?? depot
  }
  const a = p.activity
  if (a.kind === 'at_stop') return at(a.orderId)
  if (a.kind !== 'driving' && a.kind !== 'held_up') return depot
  const next = p.next
  if (!next) return depot
  const stops = route.trips.flatMap((t) => t.stops)
  const index = stops.findIndex((s) => s.orderId === next.orderId)
  const trip = route.trips.find((t) => t.stops.some((s) => s.orderId === next.orderId))
  const from = index > 0 && trip?.stops[0].orderId !== next.orderId ? at(stops[index - 1].orderId) : depot
  const to = at(next.orderId)
  return { lat: (from.lat + to.lat) / 2, lng: (from.lng + to.lng) / 2 }
}

function DecisionCard({ proposal, message }: { proposal: PlanChange; message: AgentMessage | null }) {
  const reassign = message?.suggestions.find((s) => s.startsWith('Reassign')) ?? 'Apply change'
  const [card] = message ? messageBlocks(message.text) : []
  return (
    <Panel tone="danger">
      <h4 className="text-sm font-[560]">{card?.kind === 'card' ? card.title : proposal.summary}</h4>
      {card?.kind === 'card' && card.body && (
        <div className="mt-2 text-sm text-[var(--text-2)]">
          <MessageBlockView block={card.body} />
        </div>
      )}
      <StageActions>
        <AskButton variant="outline" say="Leave it" />
        <AskButton variant="outline" say="Text the customers" />
        <AskButton say={reassign} />
      </StageActions>
    </Panel>
  )
}

/** Runs or pauses the simulated clock, and sets how many simulated minutes pass each real minute. */
function ClockControls() {
  const { data: clock } = useDayClock()
  const set = useSetDayClock()
  if (!clock) return null
  const running = clock.kind === 'running'
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <Button variant="outline" size="sm" disabled={set.isPending} onClick={() => set.mutate({ kind: running ? 'pause' : 'run' })}>
        {running ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
        {running ? 'Pause' : 'Run'}
      </Button>
      <ToggleGroup
        aria-label="Clock speed"
        size="sm"
        spacing={0}
        value={[String(clock.speed)]}
        onValueChange={(value) => {
          const next = Number(value[0])
          if (next) set.mutate({ kind: 'speed', speed: next })
        }}
      >
        {speeds.map((s) => (
          <ToggleGroupItem key={s} value={String(s)} aria-label={`${s} minutes a minute`} className="px-2.5 text-xs">
            {`${s}×`}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <span>simulated minutes per minute</span>
    </div>
  )
}

