import type { Vehicle, VehicleId } from '../types.ts'
import { deleteVehicleRow } from './cascade.ts'
import { must, mutate, newId, query, type Db } from './db.ts'
import { requireCount, requireText } from './validate.ts'

export type VehicleInput = Omit<Vehicle, 'id'>

const checked = (db: Db, input: VehicleInput): VehicleInput => {
  must(db.depot, input.depotId, 'depot')
  return { ...input, name: requireText(input.name, 'Name'), capacity: requireCount(input.capacity, 'Capacity') }
}

export const listVehicles = () => query((db) => db.vehicle)

export const getVehicle = (vehicleId: VehicleId) => query((db) => must(db.vehicle, vehicleId, 'vehicle'))

export const createVehicle = (input: VehicleInput) =>
  mutate((db) => {
    const vehicle: Vehicle = { id: newId('vehicle'), ...checked(db, input) }
    db.vehicle.push(vehicle)
    return vehicle
  })

export const updateVehicle = (vehicleId: VehicleId, patch: Partial<VehicleInput>) =>
  mutate((db) => {
    const vehicle = must(db.vehicle, vehicleId, 'vehicle')
    Object.assign(vehicle, checked(db, { ...vehicle, ...patch }))
    return vehicle
  })

/** Drivers of the vehicle are left without one, and draft plans drop their routes. */
export const deleteVehicle = (vehicleId: VehicleId) => mutate((db) => deleteVehicleRow(db, vehicleId))
