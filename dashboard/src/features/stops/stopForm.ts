import type { Order } from '../../api/types.ts'
import type { OrderInput } from './api.ts'
import { formatMinute, parseMinute } from '../../lib/time.ts'

/** What the stop form holds while the dispatcher types: every field as text. */
export type StopDraft = {
  customer: string
  phone: string
  addressRaw: string
  quantity: string
  serviceMinutes: string
  windowStart: string
  windowEnd: string
  notes: string
}

export const emptyDraft: StopDraft = { customer: '', phone: '', addressRaw: '', quantity: '1', serviceMinutes: '', windowStart: '', windowEnd: '', notes: '' }

export function draftOf(order: Order): StopDraft {
  return {
    customer: order.customer,
    phone: order.phone ?? '',
    addressRaw: order.addressRaw,
    quantity: String(order.quantity),
    serviceMinutes: order.serviceMinutes === null ? '' : String(order.serviceMinutes),
    windowStart: order.window ? formatMinute(order.window.start) : '',
    windowEnd: order.window ? formatMinute(order.window.end) : '',
    notes: order.notes,
  }
}

/** Reads the draft into a stop, or says what to fix. Required text and counts are checked again by the server. */
export function parseDraft(draft: StopDraft): { input: OrderInput } | { error: string } {
  const start = draft.windowStart ? parseMinute(draft.windowStart) : null
  const end = draft.windowEnd ? parseMinute(draft.windowEnd) : null
  if (Boolean(draft.windowStart) !== Boolean(draft.windowEnd)) return { error: 'Give the time window a start and an end, or leave both empty.' }
  if (draft.windowStart && (start === null || end === null || start >= end)) return { error: 'The time window must end after it starts.' }
  const quantity = Number(draft.quantity)
  if (!Number.isInteger(quantity) || quantity < 1) return { error: 'Load must be a whole number of boxes, 1 or more.' }
  const service = draft.serviceMinutes.trim() === '' ? null : Number(draft.serviceMinutes)
  if (service !== null && !(Number.isInteger(service) && service >= 0)) return { error: 'Service time must be a whole number of minutes.' }
  return {
    input: {
      customer: draft.customer,
      phone: draft.phone,
      addressRaw: draft.addressRaw,
      quantity,
      serviceMinutes: service,
      window: start !== null && end !== null ? { start, end } : null,
      notes: draft.notes,
    },
  }
}
