// Tests for the mock server in src/api/mock/. Run with `npm test`. Node strips the types, so no build is needed.
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

const { STORAGE_KEY, setMockLatency } = await import('../src/api/mock/db.ts')
const { getWorkspace, resetDemo, clearAll, getSampleOrdersFile } = await import('../src/api/mock/workspace.ts')
const { createDepot, listDepots, updateDepot, deleteDepot } = await import('../src/api/mock/depot.ts')
const { createVehicle, deleteVehicle, listVehicles } = await import('../src/api/mock/vehicle.ts')
const { listDrivers, updateDrivers } = await import('../src/api/mock/driver.ts')
const { listOrders, fixOrderLocation } = await import('../src/api/mock/order.ts')
const { createOrderImport, commitOrderImport } = await import('../src/api/mock/orderImport.ts')
const { getCurrentPlan, previewChange, proposeChange, applyChange, undoChange, sendPlan } = await import('../src/api/mock/plan.ts')
const { startDay } = await import('../src/api/mock/liveDay.ts')
const { routeProgress } = await import('../src/api/mock/clock.ts')
const { solve } = await import('../src/api/mock/planner.ts')
const { problemOf, rulesOf } = await import('../src/api/mock/planStore.ts')
const { sampleDb } = await import('../src/api/mock/seed.ts')

setMockLatency(0)
beforeEach(() => store.clear())

const allStops = (view: { routes: { trips: { stops: { orderId: string }[] }[] }[] }) =>
  view.routes.flatMap((r) => r.trips.flatMap((t) => t.stops.map((s) => s.orderId)))

test('a first visit starts with an empty workspace', async () => {
  const ws = await getWorkspace()
  assert.deepEqual(ws.setup, { depot: false, drivers: false, stops: false, plan: false })
  assert.equal(ws.currentPlanId, null)
})

test('unreadable stored data starts an empty workspace instead of crashing', async () => {
  store.set(STORAGE_KEY, '{"version":1,"depot":[{"id":42}]}')
  assert.equal((await getWorkspace()).counts.depots, 0)
  store.set(STORAGE_KEY, 'not json')
  assert.equal((await getWorkspace()).counts.orders, 0)
})

test('the sample workspace matches the designs and plans every order it can place', async () => {
  await resetDemo()
  const orders = await listOrders()
  const statuses = Object.groupBy(orders, (o) => o.geocode.status)
  assert.equal(orders.length, 180)
  assert.equal(statuses.ok?.length, 176)
  assert.deepEqual(statuses.check?.map((o) => o.customer), ['Toko Sinar Jaya', 'Bu Ratna', 'Kopi Lor'])
  assert.deepEqual(statuses.not_found?.map((o) => o.customer), ['Pak Hadi'])
  const view = await getCurrentPlan()
  assert.ok(view)
  const placed = allStops(view)
  assert.equal(new Set(placed).size, placed.length, 'no order is on two routes')
  assert.equal(placed.length + view.unassigned.length, 180, 'every order is on a route or listed as unassigned')
  assert.deepEqual(view.unassigned.map((u) => u.reason), ['no_location'])
  assert.ok(view.routes.every((r) => r.trips.every((t) => t.stops.every((s) => s.lateMinutes === 0))), 'strict windows are kept')
  assert.ok(view.routes.every((r) => r.trips.every((t) => t.load <= 40)), 'no trip carries more than the biggest vehicle')
})

test('solving the same problem twice gives the same routes', () => {
  const db = sampleDb('2026-11-21' as never, '2026-11-21T06:00:00.000Z')
  const [plan] = db.plan
  const problem = problemOf(db, plan, rulesOf(plan))
  assert.deepEqual(solve(problem), solve(problem))
})

test('a depot survives a create, update, and reload round trip, and bad input gets a readable error', async () => {
  const depot = await createDepot({
    name: 'Dapur Layur',
    address: 'Jl. Layur VII No.12, Mantrijeron, Yogyakarta',
    location: { lat: -7.818, lng: 110.3575 },
    hours: { start: 480, end: 960 },
    loadMinutes: 15,
  })
  await updateDepot(depot.id, { loadMinutes: 20 })
  const stored = JSON.parse(store.get(STORAGE_KEY)!)
  assert.equal(stored.depot[0].loadMinutes, 20)
  assert.deepEqual((await listDepots()).map((d) => d.name), ['Dapur Layur'])
  await assert.rejects(updateDepot(depot.id, { name: '  ' }), { message: 'Name is required.' })
  await assert.rejects(updateDepot(depot.id, { hours: { start: 960, end: 480 } }), { message: 'Opening hours must end after it starts.' })
  await createVehicle({ name: 'Motorbike 1', kind: 'motorbike', capacity: 10, depotId: depot.id })
  await assert.rejects(deleteDepot(depot.id), /still has 1 vehicle/)
})

test('deleting a vehicle leaves its driver without one and moves the stops to other routes', async () => {
  await resetDemo()
  const before = (await getCurrentPlan())!
  const agus = (await listDrivers()).find((d) => d.name === 'Agus Pratama')!
  await deleteVehicle(agus.vehicleId!)
  assert.equal((await listDrivers()).find((d) => d.id === agus.id)!.vehicleId, null)
  assert.equal((await listVehicles()).length, 9)
  const after = (await getCurrentPlan())!
  assert.equal(after.routes.some((r) => r.driverId === agus.id), false)
  assert.ok(!after.plan.driverIds.includes(agus.id))
  assert.equal(after.plan.version, before.plan.version + 1)
  assert.equal(allStops(after).length + after.unassigned.length, 180, 'no order disappears')
})

test('a proposed move previews, applies, and undoes', async () => {
  await resetDemo()
  const view = (await getCurrentPlan())!
  const [from, to] = view.routes
  const orderId = from.trips[0].stops[0].orderId
  const diff = [{ kind: 'move_stop' as const, orderId, fromDriverId: from.driverId, toDriverId: to.driverId }]
  const preview = await previewChange(view.plan.id, diff)
  assert.ok(allStops({ routes: preview.routes.filter((r) => r.driverId === to.driverId) }).includes(orderId))
  assert.ok(preview.impact.drivers.some((d) => d.driverId === to.driverId && (d.minutesDelta > 0 || d.kmDelta > 0)), 'the receiving driver drives more')
  assert.equal(allStops(preview).length + preview.unassigned.length, 180, 'a move never loses an order')
  assert.ok(allStops({ routes: (await getCurrentPlan())!.routes.filter((r) => r.driverId === from.driverId) }).includes(orderId), 'a preview saves nothing')
  const change = await proposeChange(view.plan.id, { authorKind: 'agent', summary: 'Move a stop', diff })
  const applied = await applyChange(change.id)
  assert.equal(applied.plan.version, view.plan.version + 1)
  assert.ok(allStops({ routes: applied.routes.filter((r) => r.driverId === to.driverId) }).includes(orderId))
  const undone = await undoChange(change.id)
  assert.deepEqual(undone.routes, view.routes)
  await assert.rejects(undoChange(change.id), { message: 'Only an applied change can be undone.' })
})

test('importing the sample spreadsheet maps the Indonesian headers and places the addresses', async () => {
  await clearAll()
  const file = await getSampleOrdersFile()
  const imp = await createOrderImport(file.fileName, file.text)
  assert.deepEqual(imp.columns, ['Nama Pelanggan', 'Alamat', 'Jam Antar', 'Jumlah Box', 'No HP', 'Catatan'])
  assert.deepEqual(imp.mapping, { customer: 0, address: 1, window: 2, quantity: 3, phone: 4, notes: 5, serviceMinutes: null })
  const result = await commitOrderImport(imp.id, { rememberMapping: true })
  assert.deepEqual(result.counts, { ok: 176, check: 3, not_found: 1, manual: 0 })
  const warung = (await listOrders()).find((o) => o.customer === 'Warung Pojok')!
  assert.deepEqual(warung.window, { start: 600, end: 720 })
  assert.equal(warung.quantity, 3)
  const toko = (await listOrders()).find((o) => o.customer === 'Toko Sinar Jaya')!
  const fixed = await fixOrderLocation(toko.id, { kind: 'candidate', index: 1 })
  assert.equal(fixed.geocode.status, 'ok')
  await assert.rejects(commitOrderImport(imp.id, { rememberMapping: false }), /already imported/)
})

test('sending reaches app users in the app, others by link, and names drivers with no way to reach them', async () => {
  await resetDemo()
  const view = (await getCurrentPlan())!
  const { dispatches, unreachable } = await sendPlan(view.plan.id, { linkChannel: 'whatsapp', notifyCustomers: false, notifyOnChange: true })
  const drivers = await listDrivers()
  const name = (id: string) => drivers.find((d) => d.id === id)!.name
  assert.equal(dispatches.find((d) => name(d.driverId) === 'Budi Santoso')?.channel, 'app')
  assert.equal(dispatches.find((d) => name(d.driverId) === 'Agus Pratama')?.channel, 'whatsapp')
  assert.deepEqual(unreachable.map(name), ['Fitri Handayani'])
  assert.equal((await getCurrentPlan())!.plan.status, 'sent')
})

test('the live day derives stop status from the clock and delays stops after an incident', async () => {
  await resetDemo()
  const view = (await getCurrentPlan())!
  await assert.rejects(startDay(view.plan.id), { message: 'Send the routes before you start the day.' })
  await sendPlan(view.plan.id, { linkChannel: 'sms', notifyCustomers: false, notifyOnChange: true })
  await startDay(view.plan.id)
  const route = view.routes[0]
  const first = route.trips[0].stops[0]
  assert.equal(routeProgress(route, [], first.eta - 1).stops[0].status, 'pending')
  assert.equal(routeProgress(route, [], first.eta).stops[0].status, 'arrived')
  assert.equal(routeProgress(route, [], first.etd).stops[0].status, 'done')
  const incident = { id: 'incident_x' as never, planId: view.plan.id, driverId: route.driverId, at: first.eta - 30, delayMinutes: 25, place: 'Jl. Godean' }
  const delayed = routeProgress(route, [incident], first.eta)
  assert.equal(delayed.stops[0].status, 'pending')
  assert.equal(delayed.stops[0].expectedEta, first.eta + 25)
})

test('defaults apply to several drivers at once, or to none when one is invalid', async () => {
  await resetDemo()
  const ids = (await listDrivers()).map((d) => d.id)
  await updateDrivers(ids, { shift: { start: 420, end: 900 } })
  assert.ok((await listDrivers()).every((d) => d.shift.start === 420))
  await assert.rejects(updateDrivers(ids, { shift: { start: 900, end: 420 } }), { message: 'Shift must end after it starts.' })
  assert.ok((await listDrivers()).every((d) => d.shift.start === 420), 'nothing changed')
})

// Last, because after a refused write the mock keeps the database in memory for the rest of the process.
test('when the browser refuses a write, later reads still see it', async () => {
  await resetDemo()
  const storage = globalThis.localStorage as { setItem: (k: string, v: string) => void }
  storage.setItem = () => {
    throw new Error('QuotaExceededError')
  }
  const depot = (await listDepots())[0]
  await updateDepot(depot.id, { name: 'Dapur Layur Dua' })
  assert.equal((await listDepots())[0].name, 'Dapur Layur Dua')
})
