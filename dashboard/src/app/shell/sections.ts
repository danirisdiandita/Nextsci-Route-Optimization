import { MapPin, Route, Sparkles, UsersRound, Warehouse, type LucideIcon } from 'lucide-react'

// The sidebar lists these in order. Each path needs a route in src/app/router.tsx: the sidebar links to it,
// so a path without a route fails the typecheck.
type SectionShape = { path: `/${string}`; label: string; icon: LucideIcon }

export const sections = [
  { path: '/today', label: 'Today', icon: Sparkles },
  { path: '/routes', label: 'Routes', icon: Route },
  { path: '/stops', label: 'Stops', icon: MapPin },
  { path: '/drivers', label: 'Drivers', icon: UsersRound },
  { path: '/depots', label: 'Depots', icon: Warehouse },
] as const satisfies readonly SectionShape[]

export type Section = (typeof sections)[number]

/** One of the four setup steps that the onboarding checklist links to. */
export type SetupStep = 1 | 2 | 3 | 4

declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    /** The screen's name after its section in the header, such as "New depot", or the whole title outside a section. */
    title?: string
    /** Shows "Setup step N of 4" in the header until setup is complete. */
    setupStep?: SetupStep
  }
}

type Match = { fullPath: string; staticData: { title?: string; setupStep?: SetupStep } }

/**
 * The section of the current screen: the one whose path starts the matched route's path, so /depots/new is
 * under Depots. Undefined outside the sections, such as on the not-found page or the setup checklist.
 */
export const matchedSection = (matches: readonly Match[]) => {
  const leaf = matches.at(-1)?.fullPath ?? ''
  return sections.find((section) => leaf === section.path || leaf.startsWith(`${section.path}/`))
}

/** The header title, the breadcrumb, and the setup step of the current screen. */
export const screenOf = (matches: readonly Match[]) => {
  const section = matchedSection(matches)
  const { title, setupStep } = matches.at(-1)?.staticData ?? {}
  return {
    section,
    title: title ?? section?.label ?? 'Page not found',
    crumb: section && title ? section.label : null,
    setupStep,
  }
}
