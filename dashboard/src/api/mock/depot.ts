import type { Depot, DepotId, GeocodeCandidate } from '../types.ts'
import { deleteDepotRow } from './cascade.ts'
import { must, mutate, newId, query } from './db.ts'
import { suggestAddresses } from './geocode.ts'
import { requireCount, requireText, requireWindow } from './validate.ts'

export type DepotInput = Omit<Depot, 'id'>

const checked = (input: DepotInput): DepotInput => ({
  ...input,
  name: requireText(input.name, 'Name'),
  address: requireText(input.address, 'Address'),
  hours: requireWindow(input.hours, 'Opening hours'),
  loadMinutes: requireCount(input.loadMinutes, 'Loading time', 0),
})

export const listDepots = () => query((db) => db.depot)

export const getDepot = (depotId: DepotId) => query((db) => must(db.depot, depotId, 'depot'))

export const createDepot = (input: DepotInput) =>
  mutate((db) => {
    const depot: Depot = { id: newId('depot'), ...checked(input) }
    db.depot.push(depot)
    return depot
  })

export const updateDepot = (depotId: DepotId, patch: Partial<DepotInput>) =>
  mutate((db) => {
    const depot = must(db.depot, depotId, 'depot')
    Object.assign(depot, checked({ ...depot, ...patch }))
    return depot
  })

/** Throws while vehicles belong to the depot or drivers have routes from it. Draft plans from it are deleted. */
export const deleteDepot = (depotId: DepotId) => mutate((db) => deleteDepotRow(db, depotId))

/** Addresses that match what the dispatcher typed, for the depot address field. */
export const searchAddresses = (text: string): Promise<GeocodeCandidate[]> => query(() => suggestAddresses(text))
