import { parseWindow } from '../../lib/time.ts'
import type { ColumnMapping, OrderField, TimeWindow } from '../types.ts'
import { orderFields } from '../types.ts'

/** Splits CSV text into a header row and data rows. Handles quoted cells and comma, semicolon, or tab separators. */
export function parseCsv(text: string): { columns: string[]; rows: string[][] } {
  const body = text.replace(/^﻿/, '')
  const firstLine = body.split(/\r?\n/, 1)[0] ?? ''
  const separator = [',', ';', '\t'].reduce((best, s) => (firstLine.split(s).length > firstLine.split(best).length ? s : best))
  const records: string[][] = []
  let record: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < body.length; i++) {
    const c = body[i]
    if (quoted) {
      if (c === '"' && body[i + 1] === '"') {
        cell += '"'
        i++
      } else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === separator) {
      record.push(cell.trim())
      cell = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && body[i + 1] === '\n') i++
      record.push(cell.trim())
      records.push(record)
      record = []
      cell = ''
    } else cell += c
  }
  if (cell || record.length) records.push([...record, cell.trim()])
  const nonEmpty = records.filter((r) => r.some((value) => value !== ''))
  const [columns = [], ...rows] = nonEmpty
  return { columns, rows: rows.map((r) => columns.map((_, i) => r[i] ?? '')) }
}

/** Header words that name each field, in English and Indonesian. */
const synonyms: Record<OrderField, string[]> = {
  customer: ['nama pelanggan', 'pelanggan', 'customer', 'nama', 'name', 'location', 'lokasi', 'toko'],
  address: ['alamat', 'address', 'street', 'jalan'],
  phone: ['no hp', 'hp', 'phone', 'telp', 'telepon', 'whatsapp', 'wa', 'mobile'],
  quantity: ['jumlah box', 'jumlah', 'box', 'boxes', 'kotak', 'qty', 'quantity', 'load', 'muatan'],
  window: ['jam antar', 'time window', 'window', 'jam', 'waktu', 'delivery time'],
  serviceMinutes: ['durasi', 'service time', 'service', 'duration', 'lama'],
  notes: ['catatan', 'notes', 'note', 'keterangan', 'instructions'],
}

/**
 * Guesses which column fills each order field. `memory` maps a lowercase header to the field the dispatcher
 * chose for it last time, and wins over the guess. Each column fills at most one field.
 */
export function guessMapping(columns: string[], memory: Record<string, OrderField> = {}): ColumnMapping {
  const mapping = Object.fromEntries(orderFields.map((f) => [f, null])) as ColumnMapping
  const taken = new Set<number>()
  const headers = columns.map((c) => c.trim().toLowerCase())
  headers.forEach((h, i) => {
    const field = memory[h]
    if (field && mapping[field] === null) {
      mapping[field] = i
      taken.add(i)
    }
  })
  // Longer synonyms first, so "jumlah box" claims its column before "box" could match another.
  const pairs = orderFields.flatMap((field) => synonyms[field].map((word) => ({ field, word }))).sort((a, b) => b.word.length - a.word.length)
  for (const { field, word } of pairs) {
    if (mapping[field] !== null) continue
    const exact = headers.findIndex((h, i) => !taken.has(i) && h === word)
    const index = exact >= 0 ? exact : headers.findIndex((h, i) => !taken.has(i) && h.includes(word))
    if (index >= 0) {
      mapping[field] = index
      taken.add(index)
    }
  }
  return mapping
}

/** The order fields read from one spreadsheet row. `problems` lists cells that could not be read. */
export type ImportedRow = {
  customer: string
  addressRaw: string
  phone: string | null
  quantity: number
  window: TimeWindow | null
  serviceMinutes: number | null
  notes: string
  problems: string[]
}

export function readRow(row: string[], mapping: ColumnMapping): ImportedRow {
  const cell = (field: OrderField) => {
    const index = mapping[field]
    return index === null ? '' : (row[index] ?? '').trim()
  }
  const problems: string[] = []
  const quantityText = cell('quantity')
  const quantity = quantityText ? Number.parseInt(quantityText, 10) : 1
  if (!(quantity > 0)) problems.push(`"${quantityText}" is not a number of boxes`)
  const windowText = cell('window')
  const window = windowText ? parseWindow(windowText) : null
  if (windowText && !window) problems.push(`"${windowText}" is not a time window`)
  const serviceText = cell('serviceMinutes')
  const service = serviceText ? Number.parseInt(serviceText, 10) : null
  if (serviceText && !(service !== null && service >= 0)) problems.push(`"${serviceText}" is not a number of minutes`)
  return {
    customer: cell('customer'),
    addressRaw: cell('address'),
    phone: cell('phone') || null,
    quantity: quantity > 0 ? quantity : 1,
    window,
    serviceMinutes: service !== null && service >= 0 ? service : null,
    notes: cell('notes'),
    problems,
  }
}
