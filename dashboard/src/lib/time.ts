import type { Day, Minute, TimeWindow } from '../api/types.ts'

const pad = (n: number) => String(n).padStart(2, '0')

/** 480 → "08:00". Minutes past midnight wrap into the next day. */
export function formatMinute(minute: Minute): string {
  const m = ((Math.round(minute) % 1440) + 1440) % 1440
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
}

/** "08:00", "8:00", or "08.00" → 480. Null when the text is not a time of day. */
export function parseMinute(text: string): Minute | null {
  const match = /^\s*(\d{1,2})[:.](\d{2})\s*$/.exec(text)
  if (!match) return null
  const [h, m] = [Number(match[1]), Number(match[2])]
  return h < 24 && m < 60 ? h * 60 + m : null
}

/** "08:00–16:00". */
export function formatWindow(window: TimeWindow): string {
  return `${formatMinute(window.start)}–${formatMinute(window.end)}`
}

/** "10.00-12.00", "10:00 – 12:00" → a window. Null when it is not two times in order. */
export function parseWindow(text: string): TimeWindow | null {
  const parts = text.split(/\s*[-–—]\s*|\s+to\s+|\s+s\/d\s+/i)
  if (parts.length !== 2) return null
  const [start, end] = parts.map(parseMinute)
  return start !== null && end !== null && start < end ? { start, end } : null
}

/** 95 → "1h 35m", 40 → "40 min". */
export function formatDuration(minutes: number): string {
  const m = Math.round(Math.abs(minutes))
  if (m < 60) return `${m} min`
  return m % 60 === 0 ? `${m / 60}h` : `${Math.floor(m / 60)}h ${pad(m % 60)}m`
}

/** The calendar day of a moment, in local time. */
export function toDay(date: Date): Day {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` as Day
}

export function todayDay(): Day {
  return toDay(new Date())
}

/** "2026-11-21" → "Sat 21 Nov". */
export function formatDay(day: Day): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}
