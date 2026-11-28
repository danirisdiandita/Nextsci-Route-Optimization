import type { EntityName, Id } from '../types.ts'

// Type guards for data read back from localStorage. `shape<T>` takes a guard for every key of T, so a field
// added to a type in types.ts fails the typecheck here until its guard exists.

export type Guard<T> = (value: unknown) => value is T

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

export const string: Guard<string> = (v): v is string => typeof v === 'string'
export const number: Guard<number> = (v): v is number => typeof v === 'number' && Number.isFinite(v)
export const boolean: Guard<boolean> = (v): v is boolean => typeof v === 'boolean'

export const literal =
  <const T extends string | number | boolean>(...values: readonly T[]): Guard<T> =>
  (v): v is T =>
    values.includes(v as T)

export const nullable =
  <T>(guard: Guard<T>): Guard<T | null> =>
  (v): v is T | null =>
    v === null || guard(v)

export const arrayOf =
  <T>(guard: Guard<T>): Guard<T[]> =>
  (v): v is T[] =>
    Array.isArray(v) && v.every(guard)

export const recordOf =
  <T>(guard: Guard<T>): Guard<Record<string, T>> =>
  (v): v is Record<string, T> =>
    isRecord(v) && Object.values(v).every(guard)

export const id =
  <E extends EntityName>(entity: E): Guard<Id<E>> =>
  (v): v is Id<E> =>
    typeof v === 'string' && v.startsWith(`${entity}_`)

export const shape =
  <T>(fields: { [K in keyof T]-?: Guard<T[K]> }): Guard<T> =>
  (v): v is T =>
    isRecord(v) && Object.entries(fields).every(([key, guard]) => (guard as Guard<unknown>)(v[key]))

export const union =
  <T>(...guards: Guard<T>[]): Guard<T> =>
  (v): v is T =>
    guards.some((g) => g(v))
