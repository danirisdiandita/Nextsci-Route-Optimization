// Tests for moving stops between routes: where a moved stop lands, and what a live plan accepts.
import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'

const store = new Map<string, string>()
Object.assign(globalThis, {
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, String(v)),
    removeItem: (k: string) => store.delete(k),
  },
})

const { setMockLatency } = await import('../src/api/mock/db.ts')
const { resetDemo } = await import('../src/api/mock/workspace.ts')
const { getCurrentPlan, previewChange, proposeChange, applyChange, sendPlan } = await import('../src/api/mock/plan.ts')
const { startDay, failStop } = await import('../src/api/mock/liveDay.ts')

setMockLatency(0)
beforeEach(() => store.clear())

const ids = (route: { trips: { stops: { orderId: string }[] }[] }) => route.trips.map((t) => t.stops.map((s) => s.orderId))

test('a stop dropped into a full trip goes to the next place that fits and drops no other stop', async () => {
  await resetDemo()
  const view = (await getCurrentPlan())!
  const [from, to] = view.routes
  const orderId = from.trips[0].stops[0].orderId
  const preview = await previewChange(view.plan.id, [
    { kind: 'move_stop', orderId, fromDriverId: from.driverId, toDriverId: to.driverId, at: { trip: 0, index: 1 } },
  ])
  const after = preview.routes.find((r) => r.driverId === to.driverId)!
  const trip = ids(after).findIndex((t) => t.includes(orderId))
  assert.ok(trip > 0 || ids(after)[0].indexOf(orderId) >= 1, 'never before the place it was dropped')
  assert.equal(preview.unassigned.length, view.unassigned.length)
})

test('stops handed to a driver with no room left stay off the route themselves, and no other stop is dropped', async () => {
  await resetDemo()
  const view = (await getCurrentPlan())!
  const [from, to] = view.routes
  const moved = from.trips.flatMap((t) => t.stops).slice(0, 12).map((s) => s.orderId)
  const preview = await previewChange(
    view.plan.id,
    moved.map((orderId, k) => ({ kind: 'move_stop' as const, orderId, fromDriverId: from.driverId, toDriverId: to.driverId, at: { trip: 0, index: 1 + k } })),
  )
  const kept = ids(to).flat()
  const after = ids(preview.routes.find((r) => r.driverId === to.driverId)!).flat()
  assert.ok(kept.every((id) => after.includes(id)), 'every stop the driver had stays on the route')
  assert.ok(preview.unassigned.every((u) => moved.includes(u.orderId) || view.unassigned.some((v) => v.orderId === u.orderId)))
})

test('a stop moved within its own route changes place', async () => {
  await resetDemo()
  const view = (await getCurrentPlan())!
  const route = view.routes[0]
  const [first, second] = route.trips[0].stops.map((s) => s.orderId)
  const preview = await previewChange(view.plan.id, [
    { kind: 'move_stop', orderId: first, fromDriverId: route.driverId, toDriverId: route.driverId, at: { trip: 0, index: 1 } },
  ])
  const after = preview.routes.find((r) => r.driverId === route.driverId)!
  assert.deepEqual(ids(after)[0].slice(0, 2), [second, first])
})

test('a place past the last trip starts a new trip', async () => {
  await resetDemo()
  const view = (await getCurrentPlan())!
  const to = view.routes.reduce((a, b) => (b.end < a.end ? b : a))
  const from = view.routes.find((r) => r.driverId !== to.driverId)!
  const orderId = from.trips[0].stops[0].orderId
  const preview = await previewChange(view.plan.id, [
    { kind: 'move_stop', orderId, fromDriverId: from.driverId, toDriverId: to.driverId, at: { trip: to.trips.length, index: 0 } },
  ])
  const after = preview.routes.find((r) => r.driverId === to.driverId)!
  assert.deepEqual(ids(after).at(-1), [orderId])
})

test('a live plan takes stop moves, keeps failures, and refuses changes that solve again', async () => {
  await resetDemo()
  const view = (await getCurrentPlan())!
  await sendPlan(view.plan.id, { linkChannel: 'sms', notifyCustomers: false, notifyOnChange: true })
  await startDay(view.plan.id)
  const [from, to] = view.routes
  const failed = from.trips[0].stops[0].orderId
  await failStop(view.plan.id, failed, 'Customer not home')
  const moved = from.trips.at(-1)!.stops.at(-1)!.orderId
  const change = await proposeChange(view.plan.id, {
    authorKind: 'user',
    summary: 'Move a stop',
    diff: [{ kind: 'move_stop', orderId: moved, fromDriverId: from.driverId, toDriverId: to.driverId }],
  })
  const applied = await applyChange(change.id)
  assert.equal(applied.plan.status, 'live')
  assert.ok(ids(applied.routes.find((r) => r.driverId === to.driverId)!).flat().includes(moved))
  const stop = applied.routes.flatMap((r) => r.trips.flatMap((t) => t.stops)).find((s) => s.orderId === failed)!
  assert.deepEqual(stop.failure, { reason: 'Customer not home' })
  await assert.rejects(proposeChange(view.plan.id, { authorKind: 'user', summary: 'Goal', diff: [{ kind: 'set_goal', goal: 'balance' }] }), {
    message: 'The day is running. Only stops can move between drivers now.',
  })
})
