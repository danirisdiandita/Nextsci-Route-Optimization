import type { Driver, DriverId } from '../types.ts'
import { deleteDriverRow } from './cascade.ts'
import { must, mutate, newId, query, type Db } from './db.ts'
import { optionalText, requireCount, requireText, requireWindow } from './validate.ts'

export type DriverInput = Omit<Driver, 'id'>

const checked = (db: Db, input: DriverInput): DriverInput => {
  if (input.vehicleId) must(db.vehicle, input.vehicleId, 'vehicle')
  const shift = requireWindow(input.shift, 'Shift')
  if (input.break) {
    requireWindow(input.break.window, 'Break window')
    requireCount(input.break.minutes, 'Break length')
  }
  if (input.start.kind === 'home') requireText(input.start.address, 'Home address')
  return { ...input, name: requireText(input.name, 'Name'), phone: optionalText(input.phone), shift }
}

export const listDrivers = () => query((db) => db.driver)

export const getDriver = (driverId: DriverId) => query((db) => must(db.driver, driverId, 'driver'))

export const createDriver = (input: DriverInput) =>
  mutate((db) => {
    const driver: Driver = { id: newId('driver'), ...checked(db, input) }
    db.driver.push(driver)
    return driver
  })

/** Adds several drivers at once, such as from a spreadsheet. Nothing is saved if any row is invalid. */
export const createDrivers = (inputs: DriverInput[]) =>
  mutate((db) => {
    const drivers = inputs.map((input): Driver => ({ id: newId('driver'), ...checked(db, input) }))
    db.driver.push(...drivers)
    return drivers
  })

export const updateDriver = (driverId: DriverId, patch: Partial<DriverInput>) =>
  mutate((db) => {
    const driver = must(db.driver, driverId, 'driver')
    Object.assign(driver, checked(db, { ...driver, ...patch }))
    return driver
  })

/** Applies the same change to several drivers, such as the shared defaults. Nothing is saved if any is invalid. */
export const updateDrivers = (driverIds: DriverId[], patch: Partial<DriverInput>) =>
  mutate((db) => {
    const drivers = driverIds.map((driverId) => must(db.driver, driverId, 'driver'))
    const next = drivers.map((d) => checked(db, { ...d, ...patch }))
    drivers.forEach((d, i) => Object.assign(d, next[i]))
    return drivers
  })

/** Throws when the driver has a sent route. Draft plans drop the driver and spread their stops over the others. */
export const deleteDriver = (driverId: DriverId) => mutate((db) => deleteDriverRow(db, driverId))
