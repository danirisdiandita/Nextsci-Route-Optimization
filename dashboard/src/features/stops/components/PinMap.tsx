import type { LatLng, Order, OrderId } from '@/api/types'
import { ErrorNotice } from '@/components/ErrorNotice'
import { RouteMap, type MapStop } from '@/components/RouteMap'
import { useFixOrderLocation } from '@/features/stops/hooks/useFixOrderLocation'

type Props = {
  stops: MapStop[]
  depot: LatLng | null
  selectedId: OrderId | null
  /** The stop the next click places, or null when clicks only select stops. */
  pinFor: Order | null
  onSelect: (orderId: OrderId) => void
  onPinned: () => void
}

/** The review map: click a stop to open it, or, while placing a pin, click where the stop really is. */
export function PinMap({ stops, depot, selectedId, pinFor, onSelect, onPinned }: Props) {
  const fix = useFixOrderLocation()
  const place = (location: LatLng) =>
    pinFor && fix.mutate({ orderId: pinFor.id, fix: { kind: 'pin', location, address: pinFor.addressRaw } }, { onSuccess: onPinned })
  return (
    <div className="relative min-h-72 flex-1 max-lg:order-first max-lg:h-72 max-lg:flex-none">
      <RouteMap
        label={`Map of ${stops.length} stops`}
        depot={depot}
        stops={stops}
        highlightedStopId={selectedId}
        onStopClick={(id) => onSelect(id as OrderId)}
        onMapClick={pinFor ? place : undefined}
        className={`absolute inset-0 ${pinFor ? 'cursor-crosshair' : ''}`}
      />
      {pinFor && (
        <p role="status" className="absolute top-3 left-1/2 -translate-x-1/2 rounded-full border bg-popover px-3 py-1 text-xs font-[560] shadow-md">
          {`Click where ${pinFor.customer} is`}
        </p>
      )}
      {fix.error && <ErrorNotice error={fix.error} className="absolute right-3 bottom-3 left-3" />}
    </div>
  )
}
