// Tests for src/features/routes/plan.ts: timeline blocks, where a stop lands, and how a change reads.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { DriverId, OrderId, PlanImpact, Route, RouteStop } from '../src/api/types.ts'

const { dropPosition, impactLine, nextPosition, shiftPosition, stopBlocks, stopsMissingWindow } = await import('../src/features/routes/plan.ts')

const stop = (id: string, eta: number, etd: number): RouteStop => ({ orderId: id as OrderId, eta, start: eta, etd, lateMinutes: 0, failure: null })
const route = {
  driverId: 'driver_a' as DriverId,
  trips: [
    { depart: 480, return: 560, load: 3, stops: [stop('order_1', 490, 494), stop('order_2', 500, 504), stop('order_3', 520, 524)] },
    { depart: 580, return: 640, load: 1, stops: [stop('order_4', 600, 604)] },
  ],
} as Route

test('a stop block holds the drive and the service, so a 4 minute stop is not a sliver', () => {
  const blocks = stopBlocks(route)
  assert.deepEqual(blocks.map((b) => [b.start, b.end]), [[480, 494], [494, 504], [505, 524], [585, 604]])
})

test('waiting for a window to open is left out of the block', () => {
  const early = { ...route, trips: [{ ...route.trips[0], stops: [{ ...stop('order_1', 490, 604), start: 600 }] }] } as Route
  assert.deepEqual(stopBlocks(early).map((b) => [b.start, b.end]), [[585, 604]])
})

test('a break on the way to a stop is left out of its block', () => {
  const blocks = stopBlocks({ ...route, break: { start: 504, end: 514 } })
  assert.deepEqual([blocks[2].start, blocks[2].end], [514, 524])
})

test('a drop lands in the trip running then, before the stops that start later', () => {
  assert.deepEqual(dropPosition(route, 'order_9' as OrderId, 502), { trip: 0, index: 2 })
  assert.deepEqual(dropPosition(route, 'order_9' as OrderId, 400), { trip: 0, index: 0 })
  assert.deepEqual(dropPosition(route, 'order_9' as OrderId, 700), { trip: 1, index: 1 })
  assert.deepEqual(dropPosition(undefined, 'order_9' as OrderId, 700), { trip: 0, index: 0 })
})

test('a drop counts places without the stop being moved', () => {
  assert.deepEqual(dropPosition(route, 'order_1' as OrderId, 510), { trip: 0, index: 1 })
  // order_4 is alone on trip 1, so taking it out leaves one trip.
  assert.deepEqual(dropPosition(route, 'order_4' as OrderId, 700), { trip: 0, index: 3 })
})

test('earlier and later step one place, across trips, and stop at the ends', () => {
  assert.deepEqual(shiftPosition(route, 'order_2' as OrderId, -1), { trip: 0, index: 0 })
  assert.deepEqual(shiftPosition(route, 'order_2' as OrderId, 1), { trip: 0, index: 2 })
  assert.equal(shiftPosition(route, 'order_1' as OrderId, -1), null)
  assert.deepEqual(shiftPosition(route, 'order_3' as OrderId, 1), { trip: 1, index: 0 })
  assert.deepEqual(shiftPosition(route, 'order_4' as OrderId, -1), { trip: 0, index: 3 })
  assert.equal(shiftPosition(route, 'order_4' as OrderId, 1), null)
})

test('a live handover goes before the next undelivered stop', () => {
  const progress = route.trips.flatMap((t) => t.stops).map((s, i) => ({
    orderId: s.orderId,
    status: i < 2 ? ('done' as const) : ('pending' as const),
    expectedEta: s.eta,
    delayMinutes: 0,
  }))
  assert.deepEqual(nextPosition(route, progress), { trip: 0, index: 2 })
  assert.deepEqual(nextPosition(route, progress.map((p) => ({ ...p, status: 'done' as const }))), { trip: 1, index: 1 })
})

test('a stop expected after its window end counts as missing it', () => {
  const orders = new Map([['order_3' as OrderId, { window: { start: 500, end: 530 } }]]) as never
  const late = { orderId: 'order_3' as OrderId, status: 'pending' as const, expectedEta: 545, delayMinutes: 25 }
  assert.equal(stopsMissingWindow([late], orders).length, 1)
  assert.equal(stopsMissingWindow([{ ...late, expectedEta: 520 }], orders).length, 0)
})

test('an impact reads per driver, then totals', () => {
  const impact: PlanImpact = {
    drivers: [
      { driverId: 'driver_a' as DriverId, minutesDelta: 9, kmDelta: 2, end: 900 },
      { driverId: 'driver_b' as DriverId, minutesDelta: -6, kmDelta: 1, end: 910 },
    ],
    minutesDelta: 3,
    kmDelta: 3,
    windowsHeld: true,
    lateStops: 0,
    unassignedDelta: 0,
  }
  const names: Record<string, string> = { driver_a: 'Budi', driver_b: 'Sari' }
  assert.equal(impactLine(impact, (id) => names[id]), 'Budi +9 min · Sari −6 min · +3 km total · all time windows still met')
  assert.match(impactLine({ ...impact, windowsHeld: false, lateStops: 2, unassignedDelta: 1 }, (id) => names[id]), /2 stops late · 1 stop no longer fits$/)
})
