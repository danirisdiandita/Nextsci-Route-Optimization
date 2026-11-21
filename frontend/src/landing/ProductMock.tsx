import type { CSSProperties } from 'react'
import { Icon } from './Icons'

type Point = readonly [number, number]

type Driver = {
  name: string
  vehicle: string
  color: string
  stops: Point[]
  done: number
  duration: string
  shift: readonly [start: number, end: number]
}

const DEPOT: Point = [300, 200]

const drivers: Driver[] = [
  {
    name: 'Rina',
    vehicle: 'Van 1',
    color: 'var(--route-1)',
    stops: [[240, 150], [180, 116], [118, 138], [96, 198], [150, 244], [228, 232]],
    done: 4,
    duration: '4h 10m',
    shift: [8, 12.5],
  },
  {
    name: 'Tomas',
    vehicle: 'Van 2',
    color: 'var(--route-2)',
    stops: [[342, 138], [398, 88], [470, 78], [522, 128], [482, 172], [384, 182]],
    done: 3,
    duration: '3h 45m',
    shift: [8.5, 12.5],
  },
  {
    name: 'Amara',
    vehicle: 'Truck 1',
    color: 'var(--route-3)',
    stops: [[372, 242], [452, 262], [532, 292], [502, 342], [420, 332], [342, 292]],
    done: 2,
    duration: '5h 05m',
    shift: [9, 14.5],
  },
  {
    name: 'Jun',
    vehicle: 'Van 3',
    color: 'var(--route-4)',
    stops: [[262, 272], [202, 312], [122, 322], [88, 282], [170, 280], [250, 250]],
    done: 5,
    duration: '3h 20m',
    shift: [10, 14],
  },
]

const routePath = (stops: Point[]) => [DEPOT, ...stops, DEPOT].map(([x, y]) => `${x},${y}`).join(' ')

function MapStreets() {
  const xs = Array.from({ length: 16 }, (_, i) => 20 + i * 40)
  const ys = Array.from({ length: 10 }, (_, i) => 20 + i * 40)
  return (
    <g style={{ stroke: 'color-mix(in srgb, var(--text) 5.5%, transparent)' }} strokeWidth="1">
      {xs.map((x) => (
        <line key={`x${x}`} x1={x} y1="0" x2={x} y2="400" />
      ))}
      {ys.map((y) => (
        <line key={`y${y}`} x1="0" y1={y} x2="620" y2={y} />
      ))}
      <path d="M0 360 C 160 300, 260 380, 420 300 S 620 250, 640 240" style={{ stroke: 'color-mix(in srgb, var(--accent) 10%, transparent)' }} strokeWidth="14" fill="none" />
      <path d="M40 0 L 600 400" style={{ stroke: 'color-mix(in srgb, var(--text) 9%, transparent)' }} strokeWidth="2" />
      <path d="M0 90 L 620 150" style={{ stroke: 'color-mix(in srgb, var(--text) 9%, transparent)' }} strokeWidth="2" />
    </g>
  )
}

export function RouteMap({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 620 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="620" height="400" fill="var(--surface-inset)" />
      <MapStreets />
      {drivers.map((d) => (
        <polyline
          key={d.name}
          points={routePath(d.stops)}
          fill="none"
          stroke={d.color}
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity="0.9"
        />
      ))}
      {drivers.map((d) =>
        d.stops.map(([x, y], i) => (
          <circle
            key={`${d.name}${i}`}
            cx={x}
            cy={y}
            r="5"
            fill={i < d.done ? d.color : 'var(--surface-inset)'}
            stroke={i < d.done ? 'var(--surface-inset)' : d.color}
            strokeWidth="2"
          />
        )),
      )}
      {drivers.map((d) => {
        const [x, y] = d.stops[d.done]
        return (
          <g key={`live${d.name}`}>
            <circle className="map-pulse" cx={x} cy={y} r="12" fill={d.color} />
            <circle cx={x} cy={y} r="6.5" fill={d.color} stroke="var(--text)" strokeWidth="2" />
          </g>
        )
      })}
      <rect x={DEPOT[0] - 8} y={DEPOT[1] - 8} width="16" height="16" rx="3" fill="var(--text)" />
    </svg>
  )
}

export function DispatcherFrame() {
  const total = drivers.reduce((n, d) => n + d.stops.length, 0)
  return (
    <div
      className="frame dispatcher"
      role="img"
      aria-label="The dispatcher view: four drivers' routes drawn in different colors on a city map, with a list of drivers and their progress."
    >
      <div className="frame-bar">
        <span />
        <span />
        <span />
        <div className="frame-title">Routes · Tuesday</div>
      </div>
      <div className="dispatcher-body">
        <aside className="dispatcher-side">
          <div className="side-head">
            <span>Drivers</span>
            <span className="badge badge-success">Optimized</span>
          </div>
          {drivers.map((d) => (
            <div key={d.name} className="driver-row">
              <span className="dot" style={{ background: d.color }} />
              <div className="driver-meta">
                <div className="driver-name">
                  {d.name} <span>{d.vehicle}</span>
                </div>
                <div className="driver-sub">
                  {d.stops.length} stops · {d.duration}
                </div>
                <div className="progress">
                  <div style={{ width: `${(d.done / d.stops.length) * 100}%`, background: d.color }} />
                </div>
              </div>
            </div>
          ))}
          <div className="side-foot">
            <div>
              <strong>{total}</strong>
              <span>Stops</span>
            </div>
            <div>
              <strong>{drivers.length}</strong>
              <span>Drivers</span>
            </div>
            <div>
              <strong>0</strong>
              <span>Late</span>
            </div>
          </div>
        </aside>
        <div className="dispatcher-map">
          <RouteMap className="map-svg" />
          <div className="map-chips">
            <span className="chip">
              <span className="dot" style={{ background: 'var(--success)' }} /> All stops inside their time windows
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

const HOURS = [8, 10, 12, 14, 16]

export function ScheduleFrame() {
  const pct = (h: number) => `${((h - 8) / 8) * 100}%`
  return (
    <div className="frame schedule" role="img" aria-label="A timeline of each driver's shift with their stops placed inside it.">
      <div className="schedule-hours">
        {HOURS.map((h) => (
          <span key={h} style={{ left: pct(h) }}>
            {String(h).padStart(2, '0')}:00
          </span>
        ))}
      </div>
      {drivers.map((d) => {
        const [start, end] = d.shift
        const slot = (end - start) / d.stops.length
        return (
          <div key={d.name} className="schedule-row">
            <div className="schedule-name">
              <span className="dot" style={{ background: d.color }} />
              {d.name}
            </div>
            <div className="schedule-track">
              <div className="schedule-shift" style={{ left: pct(start), width: `${((end - start) / 8) * 100}%` }} />
              {d.stops.map((_, i) => (
                <div
                  key={i}
                  className="schedule-stop"
                  style={
                    {
                      left: pct(start + i * slot + slot * 0.15),
                      width: `${((slot * 0.7) / 8) * 100}%`,
                      '--c': d.color,
                    } as CSSProperties
                  }
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

const phoneStops = [
  { time: '10:40', address: '18 Harbour Street', note: 'Leave at reception' },
  { time: '11:05', address: '4 Kenanga Avenue', note: '2 parcels' },
  { time: '11:30', address: '77 Orchard Lane', note: 'Call on arrival' },
]

export function PhoneFrame() {
  return (
    <div className="phone" role="img" aria-label="The driver app showing the next stop with buttons to navigate and complete it, followed by the upcoming stops.">
      <div className="phone-notch" />
      <div className="phone-head">
        <div className="phone-label">Stop 5 of 12</div>
        <div className="phone-title">Next stop</div>
      </div>
      <div className="phone-next">
        <div className="phone-addr">52 Cedar Road</div>
        <div className="phone-window">Window 10:00–11:00 · arriving 10:12</div>
        <div className="phone-actions">
          <span className="phone-btn">Navigate</span>
          <span className="phone-btn phone-btn-primary">
            <Icon name="check" size={14} /> Complete
          </span>
        </div>
      </div>
      <div className="phone-list-label">Upcoming</div>
      {phoneStops.map((s) => (
        <div key={s.address} className="phone-stop">
          <span className="phone-time">{s.time}</span>
          <div>
            <div className="phone-stop-addr">{s.address}</div>
            <div className="phone-stop-note">{s.note}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

const importRows = [
  ['52 Cedar Road', '10:00–11:00', '18 kg'],
  ['18 Harbour Street', '10:30–12:00', '6 kg'],
  ['4 Kenanga Avenue', '11:00–13:00', '24 kg'],
  ['77 Orchard Lane', '11:00–12:00', '9 kg'],
]

export function ImportVisual() {
  return (
    <div className="mini mini-import" aria-hidden="true">
      <div className="mini-file">
        <Icon name="upload" size={14} /> orders-tuesday.csv
      </div>
      {importRows.map((r) => (
        <div key={r[0]} className="mini-row">
          <span>{r[0]}</span>
          <span>{r[1]}</span>
          <span>{r[2]}</span>
          <Icon name="check" size={13} className="mini-ok" />
        </div>
      ))}
    </div>
  )
}

export function OptimizeVisual() {
  const d = drivers[1]
  return (
    <div className="mini mini-optimize" aria-hidden="true">
      <svg viewBox="282 62 260 156" preserveAspectRatio="xMidYMid meet">
        <polyline points={routePath(d.stops)} fill="none" stroke={d.color} strokeWidth="2.5" strokeLinejoin="round" className="draw" />
        {d.stops.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="5" fill="var(--surface-inset)" stroke={d.color} strokeWidth="2" />
        ))}
        <rect x={DEPOT[0] - 6} y={DEPOT[1] - 6} width="12" height="12" rx="2" fill="var(--text)" />
      </svg>
    </div>
  )
}

export function DispatchVisual() {
  return (
    <div className="mini mini-dispatch" aria-hidden="true">
      {drivers.slice(0, 3).map((d) => (
        <div key={d.name} className="mini-note">
          <span className="dot" style={{ background: d.color }} />
          <div>
            <div className="mini-note-title">Route sent to {d.name}</div>
            <div className="mini-note-sub">
              {d.vehicle} · {d.stops.length} stops
            </div>
          </div>
          <Icon name="check" size={14} className="mini-ok" />
        </div>
      ))}
    </div>
  )
}
