import { todayDay } from '../../lib/time.ts'
import type { Workspace } from '../types.ts'
import { emptyDb, mutate, query, type Db } from './db.ts'
import { currentPlan } from './planStore.ts'
import { SAMPLE_CSV_NAME, sampleDb, sampleOrdersCsv } from './seed.ts'

export function workspaceOf(db: Db): Workspace {
  return {
    setup: { depot: db.depot.length > 0, drivers: db.driver.length > 0, stops: db.order.length > 0, plan: db.plan.length > 0 },
    counts: { depots: db.depot.length, vehicles: db.vehicle.length, drivers: db.driver.length, orders: db.order.length, plans: db.plan.length },
    currentPlanId: currentPlan(db)?.id ?? null,
  }
}

/** What is set up so far. The setup checklist and the `/` redirect read it. */
export const getWorkspace = () => query(workspaceOf)

/** Swaps the whole database inside one change, so no other call writes between the read and the swap. */
const replaceWith = (make: () => Db) =>
  mutate((db) => {
    Object.assign(db, make())
    return workspaceOf(db)
  })

/** Replaces everything with the sample workspace: a Yogyakarta kitchen with a draft plan for today. */
export const resetDemo = () => replaceWith(() => sampleDb(todayDay()))

/** Deletes everything, so onboarding starts from an empty workspace. */
export const clearAll = () => replaceWith(emptyDb)

/** The sample orders spreadsheet, for trying the import without a file of your own. */
export const getSampleOrdersFile = () => query(() => ({ fileName: SAMPLE_CSV_NAME, text: sampleOrdersCsv() }))
