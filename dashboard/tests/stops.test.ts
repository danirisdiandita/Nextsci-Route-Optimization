// Tests for the stop list, the import's column matching, and the stop form in src/features/stops/.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { ColumnMapping, Driver, Order, Vehicle } from '../src/api/types.ts'

const { filterStops, countByStatus, fleetLoad, stopStatusOf } = await import('../src/features/stops/stopList.ts')
const { assignColumn, exampleValue, fieldOfColumn } = await import('../src/features/stops/importMapping.ts')
const { draftOf, emptyDraft, parseDraft } = await import('../src/features/stops/stopForm.ts')

const at = { lat: -7.8, lng: 110.37 }
const order = (id: string, patch: Partial<Order> = {}): Order =>
  ({
    id,
    customer: 'Warung Pojok',
    phone: null,
    addressRaw: 'Jl. Parangtritis No.45',
    geocode: { status: 'ok', address: 'Jl. Parangtritis No.45', location: at },
    quantity: 3,
    serviceMinutes: null,
    window: null,
    notes: '',
    importId: null,
    ...patch,
  }) as Order

const orders = [
  order('order_a', { customer: 'Toko Sinar Jaya', window: { start: 600, end: 720 } }),
  order('order_b', { geocode: { status: 'check', address: 'x', location: at, reason: '2 matches', candidates: [] } }),
  order('order_c', { geocode: { status: 'not_found' }, notes: 'belakang masjid' }),
  order('order_d', { geocode: { status: 'manual', address: 'pin', location: at } }),
]

test('a pin placed by hand counts as ready', () => {
  assert.equal(stopStatusOf(orders[3].geocode), 'ready')
  assert.deepEqual(countByStatus(orders), { ready: 2, check: 1, not_found: 1 })
})

test('the stop list filters by text, status, and window together', () => {
  const ids = (f: Parameters<typeof filterStops>[1]) => filterStops(orders, f).map((o) => o.id)
  assert.deepEqual(ids({ text: '', status: 'all', window: 'all' }), ['order_a', 'order_b', 'order_c', 'order_d'])
  assert.deepEqual(ids({ text: 'sinar', status: 'all', window: 'all' }), ['order_a'])
  assert.deepEqual(ids({ text: 'MASJID', status: 'all', window: 'all' }), ['order_c'])
  assert.deepEqual(ids({ text: '', status: 'ready', window: 'all' }), ['order_a', 'order_d'])
  assert.deepEqual(ids({ text: '', status: 'all', window: 'with' }), ['order_a'])
  assert.deepEqual(ids({ text: '', status: 'ready', window: 'without' }), ['order_d'])
})

test('fleet load counts only active drivers with a vehicle', () => {
  const vehicles = [
    { id: 'vehicle_1', capacity: 10 },
    { id: 'vehicle_2', capacity: 40 },
  ] as Vehicle[]
  const drivers = [
    { id: 'driver_1', active: true, vehicleId: 'vehicle_1' },
    { id: 'driver_2', active: false, vehicleId: 'vehicle_2' },
    { id: 'driver_3', active: true, vehicleId: null },
  ] as Driver[]
  assert.deepEqual(fleetLoad(orders, drivers, vehicles), { demand: 12, perTrip: 10, drivers: 2 })
})

test('pointing a column at a field takes the field from the column it had', () => {
  const mapping: ColumnMapping = { customer: 0, address: 1, phone: null, quantity: 2, window: null, serviceMinutes: null, notes: null }
  const moved = assignColumn(mapping, 2, 'customer')
  assert.equal(moved.customer, 2)
  assert.equal(moved.quantity, null)
  assert.equal(fieldOfColumn(moved, 0), null)
  assert.equal(fieldOfColumn(assignColumn(moved, 1, null), 1), null)
  assert.equal(mapping.customer, 0, 'the old mapping is left as it was')
})

test('a column shows its first filled cell as the example', () => {
  assert.equal(exampleValue([['', ''], ['', ' 3 ']], 1), '3')
  assert.equal(exampleValue([['a']], 1), '')
})

test('the stop form reads a draft into a stop and back', () => {
  const draft = { ...emptyDraft, customer: 'Bu Ratna', addressRaw: 'Perum Griya Asri B-12', quantity: '4', windowStart: '10:00', windowEnd: '12:00', serviceMinutes: '5' }
  const parsed = parseDraft(draft)
  assert.ok('input' in parsed)
  assert.deepEqual(parsed.input.window, { start: 600, end: 720 })
  assert.equal(parsed.input.serviceMinutes, 5)
  assert.deepEqual(draftOf(order('order_x', parsed.input)), { ...draft, phone: '' })
})

test('the stop form explains what to fix', () => {
  const error = (patch: Partial<typeof emptyDraft>) => {
    const r = parseDraft({ ...emptyDraft, customer: 'a', addressRaw: 'b', ...patch })
    return 'error' in r ? r.error : null
  }
  assert.match(error({ windowStart: '10:00' }) ?? '', /start and an end/)
  assert.match(error({ windowStart: '12:00', windowEnd: '10:00' }) ?? '', /end after/)
  assert.match(error({ quantity: '0' }) ?? '', /Load/)
  assert.match(error({ serviceMinutes: '2.5' }) ?? '', /Service time/)
  assert.equal(error({}), null)
})
