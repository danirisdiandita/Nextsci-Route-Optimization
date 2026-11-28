import { CircleAlert, MessageSquare, Send, Smartphone } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import type { Driver, PlanView } from '@/api/types'
import { RouteDot } from '@/components/RouteDot'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useDrivers } from '@/hooks/useDrivers'
import { useSendPlan } from '@/hooks/useSendPlan'
import { stopCount } from '@/lib/route'

type LinkChannel = 'sms' | 'whatsapp'
const channelName: Record<LinkChannel, string> = { sms: 'SMS', whatsapp: 'WhatsApp' }

/** Sends each route: to the Nextsci app, or as a link by SMS or WhatsApp. Drivers with neither cannot get one. */
export function SendDialog({ view, open, onOpenChange }: { view: PlanView; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data: drivers = [] } = useDrivers()
  const send = useSendPlan()
  const [linkChannel, setLinkChannel] = useState<LinkChannel>('sms')
  const [notifyCustomers, setNotifyCustomers] = useState(view.plan.notify.customers)
  const [notifyOnChange, setNotifyOnChange] = useState(view.plan.notify.onChange)
  const rows = view.routes.map((route) => ({ route, driver: drivers.find((d) => d.id === route.driverId) }))
  const reachable = rows.filter((r) => r.driver && (r.driver.hasApp || r.driver.phone)).length
  const submit = () =>
    send.mutate(
      { planId: view.plan.id, linkChannel, notifyCustomers, notifyOnChange },
      {
        onSuccess: ({ dispatches, unreachable }) => {
          onOpenChange(false)
          toast.success(`Sent ${dispatches.length} ${dispatches.length === 1 ? 'route' : 'routes'}`)
          const names = unreachable.map((id) => drivers.find((d) => d.id === id)?.name ?? 'A driver')
          if (names.length) toast.warning(`${names.join(', ')} got no route: add a phone number, then send again.`)
        },
      },
    )
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-4 sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{`Send routes to ${view.routes.length} drivers`}</DialogTitle>
          <DialogDescription>
            Each driver gets today's stops in order. Drivers without the app get a link that opens the route in their browser.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[280px] overflow-y-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-inset text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Driver</th>
                <th className="px-3 py-2 font-medium">Stops</th>
                <th className="px-3 py-2 font-medium">Sent by</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ route, driver }) => (
                <tr key={route.id} className="border-t">
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-2 font-[560]">
                      <RouteDot color={route.color} />
                      {driver?.name.split(' ')[0] ?? 'Driver'}
                    </span>
                  </td>
                  <td className="px-3 py-2 tabular-nums">{stopCount(route)}</td>
                  <td className="px-3 py-2">{driver && <Channel driver={driver} linkChannel={linkChannel} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span id="link-channel" className="text-sm">
            Send links by
          </span>
          <ToggleGroup
            aria-labelledby="link-channel"
            variant="outline"
            size="sm"
            value={[linkChannel]}
            onValueChange={(v: string[]) => v[0] && setLinkChannel(v[0] as LinkChannel)}
          >
            <ToggleGroupItem value="sms">SMS</ToggleGroupItem>
            <ToggleGroupItem value="whatsapp">WhatsApp</ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div className="grid gap-2">
          <Label className="font-normal">
            <Checkbox checked={notifyCustomers} onCheckedChange={setNotifyCustomers} />
            Text customers their delivery window
          </Label>
          <Label className="font-normal">
            <Checkbox checked={notifyOnChange} onCheckedChange={setNotifyOnChange} />
            Tell drivers again if I change their route later
          </Label>
        </div>
        {send.error && <p className="text-sm text-[var(--danger-text)]">{send.error.message}</p>}
        <DialogFooter className="items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">You can still edit routes after sending.</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button disabled={send.isPending || reachable === 0} onClick={submit}>
              <Send aria-hidden="true" />
              {`Send ${reachable} ${reachable === 1 ? 'route' : 'routes'}`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Channel({ driver, linkChannel }: { driver: Driver; linkChannel: LinkChannel }) {
  if (driver.hasApp)
    return (
      <span className="flex items-center gap-1.5 text-[var(--text-2)]">
        <Smartphone aria-hidden="true" className="size-3.5 text-[var(--success)]" />
        Nextsci app
      </span>
    )
  if (driver.phone)
    return (
      <span className="flex items-center gap-1.5 text-[var(--text-2)]">
        <MessageSquare aria-hidden="true" className="size-3.5" />
        {`Link by ${channelName[linkChannel]} · ${driver.phone}`}
      </span>
    )
  return (
    <span className="flex items-center gap-1.5 text-[var(--danger-text)]">
      <CircleAlert aria-hidden="true" className="size-3.5" />
      No phone number, cannot send
    </span>
  )
}
