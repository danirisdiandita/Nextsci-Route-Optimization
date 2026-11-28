import type { RouteColor } from '@/api/types'
import { routeColorVar } from '@/lib/route'

/** The small dot in a route's color that marks a driver in lists, tables, and the timeline. */
export function RouteDot({ color, className }: { color: RouteColor | null; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block size-2 shrink-0 rounded-full ${className ?? ''}`}
      style={{ background: color ? routeColorVar(color) : 'var(--text-4)' }}
    />
  )
}
