import type { ColumnMapping, GeocodeStatus, Order, OrderImport, OrderImportId } from '../types.ts'
import { orderFields } from '../types.ts'
import { deleteOrderImportRow } from './cascade.ts'
import { guessMapping, parseCsv, readRow, type ImportedRow } from './csv.ts'
import { must, mutate, newId, now, query } from './db.ts'
import { newOrder } from './order.ts'

export type { ImportedRow }

export type ImportResult = { orders: Order[]; counts: Record<GeocodeStatus, number>; skipped: { row: number; problem: string }[] }

export const listOrderImports = () => query((db) => db.order_import)

export const getOrderImport = (importId: OrderImportId) => query((db) => must(db.order_import, importId, 'import'))

/** Reads a CSV file and guesses which column fills each field, using the mapping remembered from last time. */
export const createOrderImport = (fileName: string, text: string) =>
  mutate((db) => {
    const { columns, rows } = parseCsv(text)
    if (!columns.length) throw new Error(`${fileName} is empty.`)
    if (!rows.length) throw new Error(`${fileName} has a header row but no stops.`)
    const orderImport: OrderImport = {
      id: newId('order_import'),
      fileName,
      columns,
      rows,
      mapping: guessMapping(columns, db.import_mapping),
      createdAt: now(),
      committedAt: null,
    }
    db.order_import.push(orderImport)
    return orderImport
  })

export const updateOrderImportMapping = (importId: OrderImportId, mapping: ColumnMapping) =>
  mutate((db) => {
    const orderImport = must(db.order_import, importId, 'import')
    orderImport.mapping = mapping
    return orderImport
  })

/** The fields each row gives with the current mapping, before anything is saved. */
export const previewOrderImport = (importId: OrderImportId): Promise<ImportedRow[]> =>
  query((db) => {
    const { rows, mapping } = must(db.order_import, importId, 'import')
    return rows.map((row) => readRow(row, mapping))
  })

/**
 * Turns the rows into stops and places each address on the map. Rows without a name or an address are
 * skipped and listed. With `rememberMapping`, the next import with the same headers starts from this mapping.
 */
export const commitOrderImport = (importId: OrderImportId, { rememberMapping }: { rememberMapping: boolean }) =>
  mutate((db): ImportResult => {
    const orderImport = must(db.order_import, importId, 'import')
    if (orderImport.committedAt) throw new Error(`${orderImport.fileName} was already imported.`)
    const { mapping, rows, columns } = orderImport
    if (mapping.customer === null) throw new Error('Pick the column that holds the customer name.')
    if (mapping.address === null) throw new Error('Pick the column that holds the address.')
    const orders: Order[] = []
    const skipped: ImportResult['skipped'] = []
    rows.forEach((row, i) => {
      const fields = readRow(row, mapping)
      if (!fields.customer || !fields.addressRaw) {
        skipped.push({ row: i + 2, problem: fields.customer ? 'no address' : 'no customer name' })
        return
      }
      orders.push(newOrder(fields, importId))
    })
    db.order.push(...orders)
    orderImport.committedAt = now()
    if (rememberMapping) {
      for (const field of orderFields) {
        const index = mapping[field]
        if (index !== null) db.import_mapping[columns[index].trim().toLowerCase()] = field
      }
    }
    const counts: Record<GeocodeStatus, number> = { ok: 0, check: 0, not_found: 0, manual: 0 }
    for (const o of orders) counts[o.geocode.status]++
    return { orders, counts, skipped }
  })

export const deleteOrderImport = (importId: OrderImportId) => mutate((db) => deleteOrderImportRow(db, importId))
