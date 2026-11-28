// Tests for the setup screens' logic: the driver defaults and the fleet writes in src/api/mock/fleet.ts.
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
const { createDepot, deleteDepot } = await import('../src/api/mock/depot.ts')
const { listDrivers } = await import('../src/api/mock/driver.ts')
const { listVehicles } = await import('../src/api/mock/vehicle.ts')
const { createFleetDrivers, updateFleetDriver, applyDriverDefaults } = await import('../src/api/mock/fleet.ts')
const { deriveDefaults, differences, formatBreak, parseBreak, parseDriverLines, startingDefaults, vehicleOf } = await import('../src/lib/driverDefaults.ts')
const { nextSetupStep } = await import('../src/lib/setupSteps.ts')

setMockLatency(0)
beforeEach(() => store.clear())

const depotInput = { name: 'Dapur', address: 'Jl. Layur No.12', location: { lat: -7.8, lng: 110.36 }, hours: { start: 480, end: 960 }, loadMinutes: 10 }
const person = (name: string) => ({
  name,
  phone: null,
  shift: startingDefaults.shift,
  break: startingDefaults.break,
  start: { kind: 'depot' as const },
  active: true,
  hasApp: false,
})

test('the sample defaults are what most drivers share, and Agus differs in shift, kind, and capacity', async () => {
  await resetDemo()
  const [drivers, vehicles] = [await listDrivers(), await listVehicles()]
  const defaults = deriveDefaults(drivers, vehicles)
  assert.deepEqual(defaults, startingDefaults)
  const agus = drivers.find((d) => d.name === 'Agus Pratama')!
  assert.deepEqual([...differences(agus, vehicleOf(agus, vehicles), defaults)].sort(), ['capacity', 'kind', 'shift'])
  const budi = drivers.find((d) => d.name === 'Budi Santoso')!
  assert.equal(differences(budi, vehicleOf(budi, vehicles), defaults).size, 0)
})

test('an empty workspace starts from the starting defaults', () => {
  assert.deepEqual(deriveDefaults([], []), startingDefaults)
})

test('breaks read back the way they are written', () => {
  assert.equal(formatBreak(startingDefaults.break), '30 min, 11:30–13:00')
  assert.deepEqual(parseBreak('30 min, 11:30–13:00'), { break: startingDefaults.break })
  assert.deepEqual(parseBreak('30, 11.30-13.00'), { break: startingDefaults.break })
  assert.deepEqual(parseBreak(''), { break: null })
  assert.deepEqual(parseBreak('No break'), { break: null })
  assert.equal(parseBreak('lunch'), null)
  assert.equal(parseBreak('120 min, 11:30–12:00'), null)
})

test('pasted driver lines skip a header and keep the phone optional', () => {
  assert.deepEqual(parseDriverLines('Name,Phone\nBudi Santoso, +62 812 0000 0101\n\nSari\tx\nTono'), [
    { name: 'Budi Santoso', phone: '+62 812 0000 0101' },
    { name: 'Sari', phone: 'x' },
    { name: 'Tono', phone: null },
  ])
})

test('adding drivers makes a vehicle for each at the depot, and fails whole without a depot', async () => {
  await assert.rejects(createFleetDrivers([{ ...person('Budi'), vehicle: { use: 'new', spec: { kind: 'motorbike', capacity: 10 } } }]), /Add a depot first/)
  assert.equal((await listDrivers()).length, 0)
  const depot = await createDepot(depotInput)
  const added = await createFleetDrivers([
    { ...person('Budi'), vehicle: { use: 'new', spec: { kind: 'motorbike', capacity: 10 } } },
    { ...person('Agus'), vehicle: { use: 'new', spec: { kind: 'car', capacity: 40 } } },
  ])
  const vehicles = await listVehicles()
  assert.equal(vehicles.length, 2)
  assert.ok(vehicles.every((v) => v.depotId === depot.id))
  assert.equal(vehicleOf(added[1], vehicles)?.capacity, 40)
})

test('one invalid row saves nothing', async () => {
  await createDepot(depotInput)
  await assert.rejects(
    createFleetDrivers([
      { ...person('Budi'), vehicle: { use: 'new', spec: { kind: 'motorbike', capacity: 10 } } },
      { ...person('  '), vehicle: { use: 'new', spec: { kind: 'motorbike', capacity: 10 } } },
    ]),
    /Name is required/,
  )
  assert.equal((await listDrivers()).length, 0)
  assert.equal((await listVehicles()).length, 0)
})

test('editing a driver changes their own vehicle in the same step', async () => {
  await resetDemo()
  const budi = (await listDrivers()).find((d) => d.name === 'Budi Santoso')!
  await updateFleetDriver(budi.id, { phone: '  ', vehicle: { use: 'existing', vehicleId: budi.vehicleId!, spec: { kind: 'van', capacity: 60 } } })
  const after = (await listDrivers()).find((d) => d.id === budi.id)!
  assert.equal(after.phone, null)
  assert.deepEqual(vehicleOf(after, await listVehicles())?.kind, 'van')
  await assert.rejects(updateFleetDriver(budi.id, { vehicle: { use: 'existing', vehicleId: budi.vehicleId!, spec: { kind: 'van', capacity: 0 } } }), /Capacity/)
})

test('applying the defaults brings every driver to them, giving a vehicle to a driver without one', async () => {
  const depot = await createDepot(depotInput)
  const drivers = await createFleetDrivers([
    { ...person('Agus'), shift: { start: 600, end: 1080 }, vehicle: { use: 'new', spec: { kind: 'car', capacity: 40 } } },
    { ...person('Tono'), vehicle: { use: 'none' } },
  ])
  await applyDriverDefaults(drivers.map((d) => d.id), startingDefaults)
  const [after, vehicles] = [await listDrivers(), await listVehicles()]
  assert.ok(after.every((d) => differences(d, vehicleOf(d, vehicles), startingDefaults).size === 0))
  assert.equal(vehicles.length, 2)
  await assert.rejects(deleteDepot(depot.id), /still has 2 vehicles/)
})

test('the next setup step is the first one not done', () => {
  assert.equal(nextSetupStep({ depot: true, drivers: false, stops: false, plan: false })?.to, '/drivers')
  assert.equal(nextSetupStep({ depot: true, drivers: true, stops: true, plan: true }), null)
})

test('the defaults bar reads back what it shows, and names each field to fix', async () => {
  const { draftOfDefaults, parseDefaultsDraft } = await import('../src/lib/driverDefaults.ts')
  assert.deepEqual(draftOfDefaults(startingDefaults), { shift: '08:00–16:00', break: '30 min, 11:30–13:00', kind: 'motorbike', capacity: '10' })
  assert.deepEqual(parseDefaultsDraft(draftOfDefaults(startingDefaults)), { defaults: startingDefaults })
  assert.deepEqual(parseDefaultsDraft({ shift: '8-16', break: 'lunch', kind: 'car', capacity: '0' }), {
    errors: {
      shift: 'Write the shift as 08:00–16:00.',
      break: 'Write the break as 30 min, 11:30–13:00, or leave it empty.',
      capacity: 'Capacity is a whole number of boxes, 1 or more.',
    },
  })
  assert.deepEqual(parseDefaultsDraft({ shift: '10:00 - 18:00', break: '', kind: 'car', capacity: '40 boxes' }), {
    defaults: { shift: { start: 600, end: 1080 }, break: null, vehicle: { kind: 'car', capacity: 40 } },
  })
})
