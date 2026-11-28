import type { ColumnMapping, OrderField } from '../../api/types.ts'
import { orderFields } from '../../api/types.ts'

/** The field a column fills, or null when the import leaves the column out. */
export function fieldOfColumn(mapping: ColumnMapping, column: number): OrderField | null {
  return orderFields.find((f) => mapping[f] === column) ?? null
}

/** Points the column at one field, or at none. The field leaves the column it had, so each column fills one field. */
export function assignColumn(mapping: ColumnMapping, column: number, field: OrderField | null): ColumnMapping {
  const next = { ...mapping }
  for (const f of orderFields) if (next[f] === column) next[f] = null
  if (field) next[field] = column
  return next
}

/** The first filled cell of the column, to show what it holds. */
export function exampleValue(rows: string[][], column: number): string {
  return rows.find((r) => r[column]?.trim())?.[column].trim() ?? ''
}
