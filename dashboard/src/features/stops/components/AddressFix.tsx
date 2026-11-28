import { Link } from '@tanstack/react-router'
import { MapPin } from 'lucide-react'
import { useState } from 'react'
import type { Order } from '@/api/types'
import { ErrorNotice } from '@/components/ErrorNotice'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useDeleteOrder } from '@/features/stops/hooks/useDeleteOrder'
import { useFixOrderLocation } from '@/features/stops/hooks/useFixOrderLocation'
import { useUpdateOrder } from '@/features/stops/hooks/useUpdateOrder'

type Props = {
  order: Order
  /** True while the next click on the map places this stop. */
  pinning: boolean
  onPinningChange: (pinning: boolean) => void
}

/** The ways to fix one address: pick a match, retype it, keep the street, drop a pin, or skip the stop. */
export function AddressFix({ order, pinning, onPinningChange }: Props) {
  const fix = useFixOrderLocation()
  const update = useUpdateOrder()
  const remove = useDeleteOrder()
  const [address, setAddress] = useState(order.addressRaw)
  const { geocode } = order
  const busy = fix.isPending || update.isPending || remove.isPending
  const source = order.importId ? 'In file' : 'Typed'

  if (geocode.status === 'ok' || geocode.status === 'manual') {
    return (
      <div className="grid gap-2 text-sm">
        <p className="text-muted-foreground">{`${geocode.status === 'manual' ? 'Pinned' : 'Placed'} at ${geocode.address}`}</p>
        <Link to="/stops/$orderId" params={{ orderId: order.id }} className="text-brand">
          Open stop
        </Link>
      </div>
    )
  }

  return (
    <div className="grid gap-3 text-sm">
      <p className="text-muted-foreground">{`${source}: "${order.addressRaw}"`}</p>
      {geocode.status === 'check' && geocode.candidates.length > 0 && (
        <RadioGroup
          aria-label={`Places that match ${order.customer}`}
          value={null}
          disabled={busy}
          onValueChange={(value) => fix.mutate({ orderId: order.id, fix: { kind: 'candidate', index: Number(value) } })}
        >
          {geocode.candidates.map((c, i) => (
            <label key={c.address} className="flex cursor-pointer items-center gap-2 rounded-lg border bg-background px-3 py-2 hover:border-[var(--border-strong)]">
              <RadioGroupItem value={String(i)} />
              {c.address}
            </label>
          ))}
        </RadioGroup>
      )}
      {geocode.status === 'check' && geocode.candidates.length === 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground">{`Best guess: ${geocode.address}`}</span>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => fix.mutate({ orderId: order.id, fix: { kind: 'pin', location: geocode.location, address: geocode.address } })}>
            Keep this place
          </Button>
        </div>
      )}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          update.mutate({ orderId: order.id, patch: { addressRaw: address } })
        }}
      >
        <Input aria-label={`Address for ${order.customer}`} value={address} onChange={(e) => setAddress(e.target.value)} className="h-8" />
        <Button type="submit" size="sm" variant="outline" disabled={busy || address.trim() === order.addressRaw}>
          Find again
        </Button>
      </form>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button size="sm" variant={pinning ? 'default' : 'ghost'} aria-pressed={pinning} disabled={busy} onClick={() => onPinningChange(!pinning)}>
          <MapPin data-icon="inline-start" />
          {pinning ? 'Click the map to place the pin' : 'Or drop the pin on the map'}
        </Button>
        {geocode.status === 'not_found' && (
          <Button size="sm" variant="ghost" className="text-muted-foreground" disabled={busy} onClick={() => remove.mutate(order.id)}>
            Skip this stop
          </Button>
        )}
      </div>
      <ErrorNotice error={fix.error ?? update.error ?? remove.error} />
    </div>
  )
}
