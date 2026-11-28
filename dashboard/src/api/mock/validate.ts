import type { TimeWindow } from '../types.ts'

// Checks for values that come from forms. Each throws an Error whose message the dashboard shows as it is.

export function requireText(value: string, label: string): string {
  const v = value.trim()
  if (!v) throw new Error(`${label} is required.`)
  return v
}

export function optionalText(value: string | null): string | null {
  const v = value?.trim() ?? ''
  return v || null
}

export function requireWindow(window: TimeWindow, label: string): TimeWindow {
  if (!(window.start >= 0 && window.end <= 24 * 60 && window.start < window.end)) throw new Error(`${label} must end after it starts.`)
  return window
}

export function requireCount(n: number, label: string, min = 1): number {
  if (!(Number.isInteger(n) && n >= min)) throw new Error(`${label} must be a whole number of at least ${min}.`)
  return n
}
