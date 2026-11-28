import { useRef, type KeyboardEvent, type MouseEvent } from 'react'
import { streets } from '@/api/mock/geocode'
import type { LatLng, RouteColor } from '@/api/types'
import { useElementSize } from '@/hooks/useElementSize'
import { routeColorVar } from '@/lib/route'

export type MapRoute = {
  id: string
  color: RouteColor
  /** One line per trip, from the depot and back. `routePaths` in src/lib/route.ts builds them. */
  paths: LatLng[][]
  /** Drawn faintly, such as the routes behind a highlighted one. */
  muted?: boolean
}

export type MapStop = {
  id: string
  location: LatLng
  label: string
  /** The route color, or null for a stop on no route. */
  color: RouteColor | null
  /** A stop whose address needs a check gets a warning ring. */
  warning?: boolean
}

/** A driver's position during the live day. */
export type MapDriver = { id: string; location: LatLng; label: string; color: RouteColor; alert?: boolean }

type Props = {
  /** What the map shows, for screen readers, such as "Map of 9 routes from Dapur Layur". */
  label: string
  depot: LatLng | null
  routes?: MapRoute[]
  stops?: MapStop[]
  drivers?: MapDriver[]
  highlightedStopId?: string | null
  onStopClick?: (stopId: string) => void
  /** Called with the place under the pointer when the dispatcher clicks the map, such as to drop a pin. */
  onMapClick?: (at: LatLng) => void
  className?: string
}

const PAD = 28

/**
 * A map drawn in SVG with no tiles: the known streets as faint lines, routes in their colors, stops as dots,
 * and the depot as a square. It zooms to fit what it shows, and sizes everything in screen pixels.
 */
export function RouteMap({ label, depot, routes = [], stops = [], drivers = [], highlightedStopId, onStopClick, onMapClick, className }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const { width, height } = useElementSize(ref)
  const points = [...(depot ? [depot] : []), ...stops.map((s) => s.location), ...routes.flatMap((r) => r.paths.flat()), ...drivers.map((d) => d.location)]
  const { project, unproject } = projection(points, width, height)
  const mapClick =
    onMapClick &&
    ((e: MouseEvent<SVGSVGElement>) => {
      const box = e.currentTarget.getBoundingClientRect()
      onMapClick(unproject(e.clientX - box.left, e.clientY - box.top))
    })
  const click = (id: string) =>
    onStopClick &&
    ((e: MouseEvent) => {
      e.stopPropagation()
      onStopClick(id)
    })
  const key = (id: string) =>
    onStopClick &&
    ((e: KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== ' ') return
      e.preventDefault()
      onStopClick(id)
    })
  return (
    <div ref={ref} className={`relative overflow-hidden bg-inset ${className ?? ''}`}>
      {width > 0 && (
        <svg role="img" aria-label={label} width={width} height={height} className="absolute inset-0 block" onClick={mapClick}>
          <g style={{ stroke: 'color-mix(in srgb, var(--text) 6%, transparent)' }} strokeWidth={1}>
            {streets.map((s) => {
              const [a, b] = [project(extend(s.from, s.to, -0.6)), project(extend(s.from, s.to, 1.6))]
              return <line key={s.name} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
            })}
          </g>
          {routes.map((r) => (
            <g key={r.id} fill="none" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" style={{ stroke: routeColorVar(r.color), opacity: r.muted ? 0.25 : 1 }}>
              {r.paths.map((path, i) => (
                <polyline key={i} points={path.map((p) => { const q = project(p); return `${q.x},${q.y}` }).join(' ')} />
              ))}
            </g>
          ))}
          {stops.map((s) => {
            const p = project(s.location)
            const highlighted = s.id === highlightedStopId
            return (
              <g key={s.id} onClick={click(s.id)} onKeyDown={key(s.id)} tabIndex={onStopClick ? 0 : undefined} role={onStopClick ? 'button' : undefined} aria-label={onStopClick ? s.label : undefined} className={onStopClick ? 'cursor-pointer outline-none focus-visible:[&>circle:last-child]:stroke-brand' : undefined}>
                <title>{s.label}</title>
                {s.warning && <circle cx={p.x} cy={p.y} r={highlighted ? 13 : 9} style={{ fill: 'color-mix(in srgb, var(--warning) 25%, transparent)' }} />}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={highlighted ? 7 : 4.5}
                  strokeWidth={2}
                  style={{
                    fill: s.warning ? 'var(--warning)' : s.color ? routeColorVar(s.color) : 'var(--text-4)',
                    stroke: highlighted ? 'var(--text)' : 'var(--surface-inset)',
                  }}
                />
              </g>
            )
          })}
          {depot && (() => {
            const p = project(depot)
            return <rect x={p.x - 6} y={p.y - 6} width={12} height={12} rx={2} style={{ fill: 'var(--text)', stroke: 'var(--surface-inset)' }} strokeWidth={2}><title>Depot</title></rect>
          })()}
          {drivers.map((d) => {
            const p = project(d.location)
            return (
              <g key={d.id}>
                <title>{d.label}</title>
                {d.alert && <circle cx={p.x} cy={p.y} r={12} style={{ fill: 'color-mix(in srgb, var(--danger) 30%, transparent)' }} />}
                <circle cx={p.x} cy={p.y} r={6} strokeWidth={2} style={{ fill: routeColorVar(d.color), stroke: 'var(--text)' }} />
              </g>
            )
          })}
        </svg>
      )}
    </div>
  )
}

/** A point along the line from `a` to `b`: 0 is `a`, 1 is `b`, and values outside extend the line. */
const extend = (a: LatLng, b: LatLng, t: number): LatLng => ({ lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t })

/** Fits the points into the box, keeping distances true in both directions. */
function projection(points: LatLng[], width: number, height: number) {
  const fallback = { lat: -7.8, lng: 110.37 }
  const lats = points.length ? points.map((p) => p.lat) : [fallback.lat]
  const lngs = points.length ? points.map((p) => p.lng) : [fallback.lng]
  const kx = Math.cos((lats[0] * Math.PI) / 180)
  const span = 0.01
  let [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)]
  if (maxLat - minLat < span) [minLat, maxLat] = [minLat - span / 2, maxLat + span / 2]
  if (maxLng - minLng < span) [minLng, maxLng] = [minLng - span / 2, maxLng + span / 2]
  const w = (maxLng - minLng) * kx
  const h = maxLat - minLat
  const scale = Math.min((width - 2 * PAD) / w, (height - 2 * PAD) / h)
  const offsetX = (width - w * scale) / 2
  const offsetY = (height - h * scale) / 2
  return {
    project: (p: LatLng) => ({ x: offsetX + (p.lng - minLng) * kx * scale, y: offsetY + (maxLat - p.lat) * scale }),
    unproject: (x: number, y: number): LatLng => ({ lat: maxLat - (y - offsetY) / scale, lng: minLng + (x - offsetX) / (kx * scale) }),
  }
}
