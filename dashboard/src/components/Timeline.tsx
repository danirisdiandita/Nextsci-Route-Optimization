import type { ReactNode } from 'react'
import type { Minute, RouteColor } from '@/api/types'
import { routeColorVar, type TimelineItem } from '@/lib/route'
import { formatMinute } from '@/lib/time'

export type TimelineRow = {
  id: string
  label: ReactNode
  color: RouteColor
  /** Shown after the label, such as "+9m" while a change is previewed. */
  note?: ReactNode
  items: TimelineItem[]
}

type Props = {
  rows: TimelineRow[]
  from: Minute
  to: Minute
  /** Draws a line at the current minute of the live day. */
  now?: Minute | null
  /** Items drawn with an accent outline, such as a stop the agent wants to move. */
  highlightedIds?: ReadonlySet<string>
  /** Items drawn as an outline only, such as a stop that a previewed change moves. */
  ghostIds?: ReadonlySet<string>
  onItemClick?: (rowId: string, itemId: string) => void
  className?: string
}

/**
 * Driver rows across the hours of a day. Each stop is a block in the route color, a break is a gray block,
 * and a reload at the depot is a dark bar. `routeTimelineItems` in src/lib/route.ts turns a route into items.
 */
export function Timeline({ rows, from, to, now, highlightedIds, ghostIds, onItemClick, className }: Props) {
  const start = Math.floor(from / 60) * 60
  const end = Math.ceil(to / 60) * 60
  const pct = (m: Minute) => `${((m - start) / (end - start)) * 100}%`
  const hours = Array.from({ length: (end - start) / 60 + 1 }, (_, i) => start + i * 60)
  return (
    <div className={`grid grid-cols-[minmax(96px,160px)_1fr] text-sm ${className ?? ''}`}>
      <div />
      <div className="relative h-6 text-xs text-muted-foreground">
        {hours.map((h) => (
          <span key={h} className="absolute -translate-x-1/2 tabular-nums" style={{ left: pct(h) }}>
            {formatMinute(h)}
          </span>
        ))}
      </div>
      {rows.map((row) => (
        <div key={row.id} className="contents">
          <div className="flex min-w-0 items-center gap-2 border-t py-3 pr-3">
            <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: routeColorVar(row.color) }} />
            <span className="truncate font-[560] text-foreground">{row.label}</span>
            {row.note && <span className="shrink-0 text-xs text-muted-foreground">{row.note}</span>}
          </div>
          <div className="relative border-t">
            {hours.map((h) => (
              <span key={h} aria-hidden="true" className="absolute inset-y-0 w-px" style={{ left: pct(h), background: 'color-mix(in srgb, var(--text) 5%, transparent)' }} />
            ))}
            {row.items.map((item) => (
              <Block
                key={item.id}
                item={item}
                color={row.color}
                left={pct(item.start)}
                width={item.kind === 'reload' ? undefined : `max(4px, calc(${pct(item.end)} - ${pct(item.start)} - 2px))`}
                highlighted={highlightedIds?.has(item.id) ?? false}
                ghost={ghostIds?.has(item.id) ?? false}
                onClick={onItemClick && (() => onItemClick(row.id, item.id))}
              />
            ))}
            {now != null && now >= start && now <= end && (
              <span aria-hidden="true" className="absolute inset-y-0 w-0.5" style={{ left: pct(now), background: 'var(--color-brand)' }} />
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

type BlockProps = {
  item: TimelineItem
  color: RouteColor
  left: string
  width: string | undefined
  highlighted: boolean
  ghost: boolean
  onClick: (() => void) | undefined
}

function Block({ item, color, left, width, highlighted, ghost, onClick }: BlockProps) {
  const title = item.kind === 'reload' ? `${item.label} · ${formatMinute(item.start)}` : `${item.label} · ${formatMinute(item.start)}–${formatMinute(item.end)}`
  const style =
    item.kind === 'reload'
      ? { left, background: 'var(--text)' }
      : item.kind === 'break'
        ? { left, width, background: 'color-mix(in srgb, var(--text) 10%, transparent)' }
        : ghost
          ? { left, width, background: 'var(--surface)', boxShadow: `inset 0 0 0 1.5px ${routeColorVar(color)}` }
          : { left, width, background: routeColorVar(color) }
  const shape = item.kind === 'reload' ? 'top-1.5 bottom-1.5 w-[3px] rounded-full' : 'top-2 bottom-2 rounded-[3px]'
  const ring = highlighted ? 'outline-2 outline-offset-1 outline-brand' : ''
  return onClick ? (
    <button type="button" title={title} aria-label={title} onClick={onClick} className={`absolute ${shape} ${ring} cursor-pointer`} style={style} />
  ) : (
    <span title={title} className={`absolute ${shape} ${ring}`} style={style} />
  )
}
