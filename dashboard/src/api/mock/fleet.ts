import { vehicleKindLabel, type DriverDefaults, type VehicleSpec } from '../../lib/driverDefaults.ts'
import type { Driver, DriverId, Vehicle, VehicleId } from '../types.ts'
import { must, mutate, newId, type Db } from './db.ts'
import type { DriverInput } from './driver.ts'
import { optionalText, requireCount, requireText, requireWindow } from './validate.ts'

// Writes that change a driver and the vehicle they drive in one step, so the dashboard never leaves a
// driver half saved. The setup screens think of a driver and their vehicle as one row.

/** Which vehicle a driver drives. */
export type VehicleChoice =
  | { use: 'none' }
  /** A vehicle that exists, with its kind and capacity changed to `spec` when it is given. */
  | { use: 'existing'; vehicleId: VehicleId; spec?: VehicleSpec }
  /** A vehicle made for this driver at the first depot. */
  | { use: 'new'; spec: VehicleSpec }

export type FleetDriverInput = Omit<DriverInput, 'vehicleId'> & { vehicle: VehicleChoice }

const checkDriver = (input: Omit<DriverInput, 'vehicleId'>) => {
  if (input.break) {
    requireWindow(input.break.window, 'Break window')
    requireCount(input.break.minutes, 'Break length')
  }
  if (input.start.kind === 'home') requireText(input.start.address, 'Home address')
  return { ...input, name: requireText(input.name, 'Name'), phone: optionalText(input.phone), shift: requireWindow(input.shift, 'Shift') }
}

const checkSpec = (spec: VehicleSpec): VehicleSpec => ({ ...spec, capacity: requireCount(spec.capacity, 'Capacity') })

function newVehicle(db: Db, spec: VehicleSpec, driverName: string): Vehicle {
  const depot = db.depot[0]
  if (!depot) throw new Error('Add a depot first, so vehicles have a place to start from.')
  const vehicle: Vehicle = { id: newId('vehicle'), name: `${vehicleKindLabel[spec.kind]} for ${driverName}`, ...checkSpec(spec), depotId: depot.id }
  db.vehicle.push(vehicle)
  return vehicle
}

function resolveVehicle(db: Db, choice: VehicleChoice, driverName: string): VehicleId | null {
  if (choice.use === 'none') return null
  if (choice.use === 'new') return newVehicle(db, choice.spec, driverName).id
  const vehicle = must(db.vehicle, choice.vehicleId, 'vehicle')
  if (choice.spec) Object.assign(vehicle, checkSpec(choice.spec))
  return vehicle.id
}

/** Adds drivers with their vehicles. Nothing is saved if any row is invalid. */
export const createFleetDrivers = (inputs: FleetDriverInput[]) =>
  mutate((db) => {
    if (!inputs.length) throw new Error('Add at least one driver.')
    return inputs.map(({ vehicle, ...input }): Driver => {
      const checked = checkDriver(input)
      const driver: Driver = { id: newId('driver'), ...checked, vehicleId: resolveVehicle(db, vehicle, checked.name) }
      db.driver.push(driver)
      return driver
    })
  })

/** Changes a driver and, when `vehicle` is given, which vehicle they drive and what it is. */
export const updateFleetDriver = (driverId: DriverId, patch: Partial<FleetDriverInput>) =>
  mutate((db) => {
    const driver = must(db.driver, driverId, 'driver')
    const { vehicle, ...rest } = patch
    const checked = checkDriver({ ...driver, ...rest })
    Object.assign(driver, checked, vehicle ? { vehicleId: resolveVehicle(db, vehicle, checked.name) } : {})
    return driver
  })

/** Gives every listed driver the default shift and break, and makes each one's vehicle the default kind and capacity. */
export const applyDriverDefaults = (driverIds: DriverId[], defaults: DriverDefaults) =>
  mutate((db) => {
    requireWindow(defaults.shift, 'Shift')
    if (defaults.break) requireWindow(defaults.break.window, 'Break window')
    const spec = checkSpec(defaults.vehicle)
    return driverIds.map((driverId) => {
      const driver = must(db.driver, driverId, 'driver')
      const choice: VehicleChoice = driver.vehicleId ? { use: 'existing', vehicleId: driver.vehicleId, spec } : { use: 'new', spec }
      Object.assign(driver, { shift: defaults.shift, break: defaults.break, vehicleId: resolveVehicle(db, choice, driver.name) })
      return driver
    })
  })
