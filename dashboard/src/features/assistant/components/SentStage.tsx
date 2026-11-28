import { Play } from 'lucide-react'
import type { Dispatch, PlanView } from '@/api/types'
import { RouteDot } from '@/components/RouteDot'
import type { SendSummary } from '@/features/assistant/api'
import { AskButton, Panel, StageActions, StageColumn, StageHeading, ToneBadge } from '@/features/assistant/components/TodayParts'
import { useDrivers } from '@/hooks/useDrivers'
import { formatMinute } from '@/lib/time'

const channelLabels: Record<Dispatch['channel'], string> = { app: 'In the app', sms: 'SMS link', whatsapp: 'WhatsApp link' }

/** Between NS 07 and NS 08: the routes went out, and the day starts when the dispatcher says so. */
export function SentStage({ view, send, dispatches }: { view: PlanView; send: SendSummary; dispatches: Dispatch[] }) {
  const { data: drivers } = useDrivers()
  const first = Math.min(...view.routes.map((r) => r.start))
  return (
    <StageColumn>
      <StageHeading
        eyebrow="Sent · waiting for the day to start"
        title={`${dispatches.length} of ${view.routes.length} routes sent`}
        aside={send.unreachable.length ? <ToneBadge tone="warning">{`${send.unreachable.length} not reached`}</ToneBadge> : <ToneBadge tone="success">Everyone has a route</ToneBadge>}
      />
      <Panel className="p-0">
        <ul className="divide-y text-sm">
          {view.routes.map((r) => {
            const sent = dispatches.find((d) => d.driverId === r.driverId)
            return (
              <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                <RouteDot color={r.color} />
                <span className="flex-1 truncate font-[560]">{drivers?.find((d) => d.id === r.driverId)?.name ?? 'Driver'}</span>
                <span className={`text-xs ${sent ? 'text-muted-foreground' : 'text-[var(--danger-text)]'}`}>{sent ? channelLabels[sent.channel] : 'No phone number'}</span>
              </li>
            )
          })}
        </ul>
      </Panel>
      <StageActions note={`The first driver leaves at ${formatMinute(first)}. The day runs on a simulated clock, ten minutes a minute.`}>
        <AskButton say="Start the day">
          <Play aria-hidden="true" />
          Start the day
        </AskButton>
      </StageActions>
    </StageColumn>
  )
}
