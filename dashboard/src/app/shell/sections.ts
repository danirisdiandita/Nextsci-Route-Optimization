import { MapPin, Route, UsersRound, Warehouse, type LucideIcon } from 'lucide-react'

type SectionShape = { id: string; label: string; icon: LucideIcon; empty: { title: string; body: string } }

export const sections = [
  {
    id: 'routes',
    label: 'Routes',
    icon: Route,
    empty: { title: 'No routes yet', body: 'Route planning arrives with the next releases.' },
  },
  {
    id: 'stops',
    label: 'Stops',
    icon: MapPin,
    empty: { title: 'No stops yet', body: 'Importing stops from CSV files arrives with the next releases.' },
  },
  {
    id: 'drivers',
    label: 'Drivers',
    icon: UsersRound,
    empty: { title: 'No drivers yet', body: 'Adding drivers and their shifts arrives with the next releases.' },
  },
  {
    id: 'depots',
    label: 'Depots',
    icon: Warehouse,
    empty: { title: 'No depots yet', body: 'Adding the depots where routes start and end arrives with the next releases.' },
  },
] as const satisfies readonly SectionShape[]

export type Section = (typeof sections)[number]
