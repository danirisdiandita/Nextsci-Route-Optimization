import { Mail, MessageCircle, Send, Smartphone, TriangleAlert } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import type { Day, Driver, PlanView } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { SendSummary } from '@/features/assistant/api'
import { AskButton, Panel, StageActions, StageColumn, StageHeading } from '@/features/assistant/components/TodayParts'
import { useSaveDriverPhone } from '@/features/assistant/hooks/useSaveDriverPhone'
import { formatDay } from '@/lib/time'

const names = (drivers: Driver[]) => (drivers.length <= 3 ? drivers.map((d) => d.name).join(', ') : `${drivers.slice(0, 2).map((d) => d.name).join(', ')} and ${drivers.length - 2} more`)

/** Design NS 07: what sending does, who cannot be reached, and the dispatcher's approval. */
export function SendStage({ view, send, day }: { view: PlanView; send: SendSummary; day: Day }) {
  const reachable = send.app.length + send.link.length
  return (
    <StageColumn>
      <StageHeading eyebrow="Ready to send · needs your OK" title={`Send ${view.routes.length} routes for ${formatDay(day)}`} />
      <Panel>
        <h3 className="text-sm font-[560]">The agent will do this when you press Send</h3>
        <ul className="mt-3 grid gap-2.5 text-sm text-[var(--text-2)]">
          {send.app.length > 0 && (
            <SendLine icon={Smartphone} text={`Push the route to ${send.app.length} driver${send.app.length === 1 ? '' : 's'} who ${send.app.length === 1 ? 'has' : 'have'} the app`} detail={names(send.app)} />
          )}
          {send.link.length > 0 && <SendLine icon={MessageCircle} text={`Text ${send.link.length} driver${send.link.length === 1 ? '' : 's'} a link that opens their route`} detail="WhatsApp" />}
          {reachable === 0 && <SendLine icon={MessageCircle} text="No driver has the app or a phone number yet" detail="" />}
          <SendLine icon={Mail} text="Tell customers their delivery window" detail="off" />
        </ul>
      </Panel>
      {send.unreachable.length > 0 && (
        <Panel tone="warning">
          <h3 className="flex items-center gap-2 text-sm font-[560]">
            <TriangleAlert aria-hidden="true" className="size-4 text-[var(--warning)]" />
            {`${send.unreachable.length} driver${send.unreachable.length === 1 ? ' has' : 's have'} no phone number`}
          </h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {send.unreachable.map((d) => (
              <PhoneField key={d.id} driver={d} />
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Without a number, a driver gets no route. Add one, or tell them their route yourself.</p>
        </Panel>
      )}
      <StageActions note={reachable === 0 ? 'Add a phone number before you send.' : undefined}>
        <AskButton variant="outline" say="Not yet" />
        <AskButton say="Send now" disabled={reachable === 0}>
          <Send aria-hidden="true" />
          Send now
        </AskButton>
      </StageActions>
    </StageColumn>
  )
}

function SendLine({ icon: Icon, text, detail }: { icon: typeof Mail; text: string; detail: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand" />
      <span className="flex-1">{text}</span>
      <span className="text-xs text-muted-foreground">{detail}</span>
    </li>
  )
}

function PhoneField({ driver }: { driver: Driver }) {
  const save = useSaveDriverPhone()
  const [phone, setPhone] = useState('')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (phone.trim()) save.mutate({ driverId: driver.id, phone })
  }
  return (
    <form onSubmit={submit} className="flex gap-2">
      <Input aria-label={`Phone number for ${driver.name}`} type="tel" placeholder={`${driver.name} · +62…`} value={phone} onChange={(e) => setPhone(e.target.value)} />
      <Button type="submit" variant="outline" disabled={!phone.trim() || save.isPending}>
        Save
      </Button>
    </form>
  )
}
