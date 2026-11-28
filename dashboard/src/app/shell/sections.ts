import { MapPin, Route, UsersRound, Warehouse, type LucideIcon } from 'lucide-react'

// The sidebar lists these in order. Each path needs a route in src/app/router.tsx: the sidebar links to it,
// so a path without a route fails the typecheck.
type SectionShape = { path: `/${string}`; label: string; icon: LucideIcon; empty: { title: string; body: string } }

export const sections = [
  {
    path: '/routes',
    label: 'Routes',
    icon: Route,
    empty: { title: 'No routes yet', body: 'Route planning arrives with the next releases.' },
  },
  {
    path: '/stops',
    label: 'Stops',
    icon: MapPin,
    empty: { title: 'No stops yet', body: 'Importing stops from CSV files arrives with the next releases.' },
  },
  {
    path: '/drivers',
    label: 'Drivers',
    icon: UsersRound,
    empty: { title: 'No drivers yet', body: 'Adding drivers and their shifts arrives with the next releases.' },
  },
  {
    path: '/depots',
    label: 'Depots',
    icon: Warehouse,
    empty: { title: 'No depots yet', body: 'Adding the depots where routes start and end arrives with the next releases.' },
  },
] as const satisfies readonly SectionShape[]

export type Section = (typeof sections)[number]

/** The section of the current screen: the one whose route matched. Undefined on the not-found page. */
export const matchedSection = (matches: readonly { fullPath: string }[]) =>
  sections.find((section) => matches.some((match) => match.fullPath === section.path))
