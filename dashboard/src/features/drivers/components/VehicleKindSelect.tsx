import { Bike, Car, Truck, type LucideIcon } from 'lucide-react'
import { vehicleKinds, type VehicleKind } from '@/api/types'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { vehicleKindLabel } from '@/lib/driverDefaults'

const vehicleKindIcon: Record<VehicleKind, LucideIcon> = { motorbike: Bike, car: Car, van: Truck }

/** Picks motorbike, car, or van. */
export function VehicleKindSelect({ id, value, onChange, className, label }: { id?: string; value: VehicleKind; onChange: (kind: VehicleKind) => void; className?: string; label?: string }) {
  const Icon = vehicleKindIcon[value]
  return (
    <Select items={vehicleKindLabel} value={value} onValueChange={(v) => v && onChange(v as VehicleKind)}>
      <SelectTrigger id={id} aria-label={label} className={className}>
        <Icon aria-hidden="true" className="text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {vehicleKinds.map((kind) => {
          const KindIcon = vehicleKindIcon[kind]
          return (
            <SelectItem key={kind} value={kind}>
              <KindIcon aria-hidden="true" />
              {vehicleKindLabel[kind]}
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}
