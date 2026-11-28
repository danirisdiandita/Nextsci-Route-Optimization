import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { DriverId, Minute, OrderId, Route, RouteColor } from '@/api/types'
import { RouteDot } from '@/components/RouteDot'
import { stopBlocks } from '@/features/routes/plan'
import { routeColorVar } from '@/lib/route'
import { formatMinute } from '@/lib/time'

export type EditRow = { driverId: DriverId; label: string; color: RouteColor; note?: { text: string; tone: 'up' | 'down' }; route: Route | undefined }

/** What the keyboard does to the focused stop: the row above or below, or one place earlier or later. */
export type KeyMove = 'up' | 'down' | 'earlier' | 'later'

type Props = {
  rows: EditRow[]
  from: Minute
  to: Minute
  now?: Minute | null
  labelOf: (orderId: OrderId) => string
  /** Stops a pending change moved, drawn as an outline. */
  ghostIds: ReadonlySet<string>
  selectedId: OrderId | null
  onSelect: (orderId: OrderId | null) => void
  /** Null when the timeline is read-only. */
  onDrop: ((orderId: OrderId, fromDriverId: DriverId, toDriverId: DriverId, minute: Minute) => void) | null
  onKeyMove: ((orderId: OrderId, driverId: DriverId, move: KeyMove) => void) | null
}

type Press = { orderId: OrderId; driverId: DriverId; x: number; y: number; pointerId: number }
type Drag = { orderId: OrderId; driverId: DriverId; color: RouteColor; x: number; y: number; lane: DriverId | null }

const keyMoves: Record<string, KeyMove> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'earlier', ArrowRight: 'later' }

/**
 * Driver rows across the day, where a stop can be dragged to another row or time. Each stop block runs from
 * leaving the stop before it to leaving this one, so even a 4 minute stop is wide enough to grab.
 */
export function EditTimeline({ rows, from, to, now, labelOf, ghostIds, selectedId, onSelect, onDrop, onKeyMove }: Props) {
  const start = Math.floor(from / 60) * 60
  const end = Math.ceil(to / 60) * 60
  const pct = (m: Minute) => `${((m - start) / (end - start)) * 100}%`
  const hours = Array.from({ length: (end - start) / 60 + 1 }, (_, i) => start + i * 60)
  const press = useRef<Press | null>(null)
  const dragged = useRef(false)
  const [drag, setDrag] = useState<Drag | null>(null)
  const root = useRef<HTMLDivElement>(null)
  // A moved stop is drawn in its new row as a new button, so keyboard focus follows it there.
  useEffect(() => {
    if (!selectedId || document.activeElement !== document.body) return
    root.current?.querySelector<HTMLElement>(`[data-order="${selectedId}"]`)?.focus()
  })

  const laneAt = (x: number, y: number) => {
    const lane = document.elementsFromPoint(x, y).find((el): el is HTMLElement => el instanceof HTMLElement && !!el.dataset.lane)
    return lane ? { driverId: lane.dataset.lane as DriverId, rect: lane.getBoundingClientRect() } : null
  }
  const down = (e: PointerEvent<HTMLButtonElement>, orderId: OrderId, driverId: DriverId) => {
    if (!onDrop || e.button !== 0) return
    press.current = { orderId, driverId, x: e.clientX, y: e.clientY, pointerId: e.pointerId }
    dragged.current = false
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const move = (e: PointerEvent<HTMLButtonElement>, color: RouteColor) => {
    const p = press.current
    if (!p || p.pointerId !== e.pointerId) return
    if (!dragged.current && Math.hypot(e.clientX - p.x, e.clientY - p.y) < 4) return
    dragged.current = true
    setDrag({ orderId: p.orderId, driverId: p.driverId, color, x: e.clientX, y: e.clientY, lane: laneAt(e.clientX, e.clientY)?.driverId ?? null })
  }
  const up = (e: PointerEvent<HTMLButtonElement>) => {
    const p = press.current
    press.current = null
    setDrag(null)
    if (!p || !dragged.current || !onDrop) return
    const lane = laneAt(e.clientX, e.clientY)
    if (!lane) return
    const minute = start + ((e.clientX - lane.rect.left) / lane.rect.width) * (end - start)
    onDrop(p.orderId, p.driverId, lane.driverId, minute)
  }
  const key = (e: KeyboardEvent, orderId: OrderId, driverId: DriverId) => {
    const m = keyMoves[e.key]
    if (!m || !onKeyMove) return
    e.preventDefault()
    onKeyMove(orderId, driverId, m)
  }

  return (
    <div ref={root} className="overflow-x-auto">
      <div className="grid min-w-[720px] grid-cols-[120px_1fr] pr-5 text-sm select-none">
        <div />
        <div className="relative h-6 text-xs text-muted-foreground">
          {hours.map((h) => (
            <span key={h} className="absolute -translate-x-1/2 tabular-nums" style={{ left: pct(h) }}>
              {formatMinute(h)}
            </span>
          ))}
        </div>
        {rows.map((row) => {
          const blocks = row.route ? stopBlocks(row.route) : []
          const target = drag?.lane === row.driverId
          return (
            <div key={row.driverId} className="contents">
              <div className={`flex min-w-0 items-center gap-2 border-t py-3 pr-2 ${target ? 'bg-brand-soft' : ''}`}>
                <RouteDot color={row.color} />
                <span className="truncate font-[560]">{row.label}</span>
                {row.note && (
                  <span className={`shrink-0 text-xs font-[560] tabular-nums ${row.note.tone === 'up' ? 'text-brand' : 'text-[var(--success)]'}`}>{row.note.text}</span>
                )}
              </div>
              <div data-lane={row.driverId} role="group" aria-label={`${row.label}'s stops`} className={`relative h-11 border-t ${target ? 'bg-brand-soft' : ''}`}>
                {hours.map((h) => (
                  <span key={h} aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-px" style={{ left: pct(h), background: 'color-mix(in srgb, var(--text) 5%, transparent)' }} />
                ))}
                {row.route?.break && (
                  <span
                    title={`Break · ${formatMinute(row.route.break.start)}–${formatMinute(row.route.break.end)}`}
                    className="absolute top-2 bottom-2 rounded-[3px]"
                    style={{ left: pct(row.route.break.start), width: `calc(${pct(row.route.break.end)} - ${pct(row.route.break.start)} - 2px)`, background: 'color-mix(in srgb, var(--text) 10%, transparent)' }}
                  />
                )}
                {row.route?.trips.slice(0, -1).map((trip, i) => (
                  <span key={i} title={`Reload at depot · ${formatMinute(trip.return)}`} className="absolute top-1.5 bottom-1.5 w-[3px] rounded-full" style={{ left: pct(trip.return), background: 'var(--text)' }} />
                ))}
                {blocks.map((b) => {
                  const ghost = ghostIds.has(b.orderId)
                  const selected = b.orderId === selectedId
                  const lifted = drag?.orderId === b.orderId
                  const label = `${labelOf(b.orderId)} · ${formatMinute(b.eta)}–${formatMinute(b.etd)}${b.late ? ' · late' : ''}${b.failed ? ' · failed' : ''}`
                  return (
                    <button
                      key={b.orderId}
                      type="button"
                      title={label}
                      aria-label={label}
                      aria-pressed={selected}
                      data-order={b.orderId}
                      className={`absolute top-2 bottom-2 touch-none rounded-[3px] outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand ${
                        selected ? 'outline-2 outline-offset-1 outline-[var(--text)]' : ''
                      } ${onDrop ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${lifted ? 'opacity-30' : ''}`}
                      style={{
                        left: pct(b.start),
                        width: `max(6px, calc(${pct(b.end)} - ${pct(b.start)} - 2px))`,
                        background: ghost ? 'var(--surface)' : b.failed ? 'color-mix(in srgb, var(--danger) 60%, transparent)' : routeColorVar(row.color),
                        boxShadow: ghost ? `inset 0 0 0 1.5px ${routeColorVar(row.color)}` : b.late ? 'inset 0 -3px 0 var(--danger)' : undefined,
                      }}
                      onPointerDown={(e) => down(e, b.orderId, row.driverId)}
                      onPointerMove={(e) => move(e, row.color)}
                      onPointerUp={up}
                      onPointerCancel={() => {
                        press.current = null
                        setDrag(null)
                      }}
                      onClick={() => {
                        if (dragged.current) return
                        onSelect(selected ? null : b.orderId)
                      }}
                      onKeyDown={(e) => key(e, b.orderId, row.driverId)}
                    />
                  )
                })}
                {now != null && now >= start && now <= end && (
                  <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-0.5" style={{ left: pct(now), background: 'var(--color-brand)' }} />
                )}
              </div>
            </div>
          )
        })}
      </div>
      {drag && (
        <span
          aria-hidden="true"
          className="pointer-events-none fixed z-50 h-7 w-5 -translate-x-1/2 -translate-y-1/2 rounded-[3px] shadow-[var(--shadow)]"
          style={{ left: drag.x, top: drag.y, background: routeColorVar(drag.color) }}
        />
      )}
    </div>
  )
}
