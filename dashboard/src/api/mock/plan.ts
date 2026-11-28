import type {
  Dispatch,
  DispatchChannel,
  Plan,
  PlanChange,
  PlanChangeId,
  PlanChangeOp,
  PlanId,
  PlanImpact,
  PlanSettings,
  PlanView,
  Route,
  UnassignedOrder,
} from '../types.ts'
import { must, mutate, newId, now, query, type Db } from './db.ts'
import { impactOf } from './planner.ts'
import {
  currentPlan,
  editPlan,
  fleetOf,
  planRows,
  removePlanRows,
  routesFromResult,
  rulesOf,
  solvePlan,
  storeRoutes,
  viewOf,
} from './planStore.ts'
import { requireCount } from './validate.ts'

/** The routes a change would produce, and what it does to the plan. Nothing is saved. */
export type PlanPreview = { routes: Route[]; unassigned: UnassignedOrder[]; impact: PlanImpact }

export type SendOptions = {
  /** How drivers without the app get their link. */
  linkChannel: Exclude<DispatchChannel, 'app'>
  notifyCustomers: boolean
  notifyOnChange: boolean
}

/** Who got a route, and the drivers who could not: no app and no phone number. */
export type SendResult = { dispatches: Dispatch[]; unreachable: Plan['driverIds'] }

/** How many applied changes of a plan can be undone in a row. */
const UNDO_DEPTH = 20

/** Ops that only move stops between drivers, which the dispatcher can still do while the day runs. */
const liveOps = new Set<PlanChangeOp['kind']>(['move_stop', 'assign_stop', 'unassign_stop'])

const editable = (plan: Plan, diff: PlanChangeOp[] = []) => {
  if (plan.status === 'live' && !(diff.length && diff.every((op) => liveOps.has(op.kind)))) {
    throw new Error('The day is running. Change routes from the live view.')
  }
}

function checkSettings(db: Db, settings: PlanSettings) {
  must(db.depot, settings.depotId, 'depot')
  requireCount(settings.serviceMinutes, 'Service time per stop', 0)
  if (!fleetOf(db, settings.driverIds).length) throw new Error('Pick at least one driver who has a vehicle.')
  if (!db.order.length) throw new Error('Add stops before you plan.')
}

export const listPlans = () => query((db) => db.plan)

export const getPlan = (planId: PlanId) => query((db) => viewOf(db, planId))

/** The newest plan with its routes. Null when nothing has been planned yet. */
export const getCurrentPlan = () =>
  query((db): PlanView | null => {
    const plan = currentPlan(db)
    return plan && viewOf(db, plan.id)
  })

/** Solves a new draft plan. It replaces any other draft for the same day. */
export const createPlan = (settings: PlanSettings) =>
  mutate((db) => {
    checkSettings(db, settings)
    for (const p of db.plan.filter((p) => p.day === settings.day && p.status === 'draft')) removePlanRows(db, p.id)
    const plan: Plan = {
      ...settings,
      id: newId('plan'),
      pins: [],
      status: 'draft',
      version: 1,
      notify: { customers: false, onChange: true },
      createdAt: now(),
    }
    db.plan.push(plan)
    storeRoutes(db, plan.id, routesFromResult(db, plan.id, solvePlan(db, plan, rulesOf(plan))))
    return viewOf(db, plan.id)
  })

/** Solves the plan again with changed settings. The version goes up. */
export const replan = (planId: PlanId, patch: Partial<Omit<PlanSettings, 'day'>> = {}) =>
  mutate((db) => {
    const plan = must(db.plan, planId, 'plan')
    editable(plan)
    const next = { ...plan, ...patch }
    checkSettings(db, next)
    Object.assign(plan, patch, { version: plan.version + 1 })
    storeRoutes(db, plan.id, routesFromResult(db, plan.id, solvePlan(db, plan, rulesOf(plan))))
    return viewOf(db, plan.id)
  })

export const deletePlan = (planId: PlanId) =>
  mutate((db) => {
    must(db.plan, planId, 'plan')
    removePlanRows(db, planId)
  })

/** What a change would do, for a preview on the map or the timeline. Nothing is saved. */
export const previewChange = (planId: PlanId, diff: PlanChangeOp[]) =>
  query((db): PlanPreview => {
    const plan = must(db.plan, planId, 'plan')
    const { before, after } = editPlan(db, plan, diff)
    return { ...routesFromResult(db, planId, after), impact: impactOf(before, after) }
  })

export const listPlanChanges = (planId: PlanId) => query((db) => db.plan_change.filter((c) => c.planId === planId))

/** Records a change for the dispatcher to apply or discard, with its impact on the current routes. */
export const proposeChange = (planId: PlanId, input: Pick<PlanChange, 'authorKind' | 'summary' | 'diff'>) =>
  mutate((db) => {
    const plan = must(db.plan, planId, 'plan')
    editable(plan, input.diff)
    const { before, after } = editPlan(db, plan, input.diff)
    const change: PlanChange = {
      id: newId('plan_change'),
      planId,
      ...input,
      impact: impactOf(before, after),
      status: 'proposed',
      before: null,
      createdAt: now(),
    }
    db.plan_change.push(change)
    return change
  })

/** Applies a proposed change to the routes as they are now. The version goes up, and the change can be undone. */
export const applyChange = (changeId: PlanChangeId) =>
  mutate((db) => {
    const change = must(db.plan_change, changeId, 'change')
    if (change.status !== 'proposed') throw new Error('This change was already applied or discarded.')
    const plan = must(db.plan, change.planId, 'plan')
    editable(plan, change.diff)
    const { rules, before, after } = editPlan(db, plan, change.diff)
    change.before = { version: plan.version, rules: rulesOf(plan), ...planRows(db, plan.id) }
    change.impact = impactOf(before, after)
    change.status = 'applied'
    storeRoutes(db, plan.id, routesFromResult(db, plan.id, after))
    Object.assign(plan, rules, { version: plan.version + 1 })
    // Each snapshot holds every route, so only the latest few stay undoable and storage does not fill up.
    const applied = db.plan_change.filter((c) => c.planId === plan.id && c.status === 'applied')
    for (const old of applied.slice(0, -UNDO_DEPTH)) old.before = null
    return viewOf(db, plan.id)
  })

export const rejectChange = (changeId: PlanChangeId) =>
  mutate((db) => {
    const change = must(db.plan_change, changeId, 'change')
    if (change.status !== 'proposed') throw new Error('This change was already applied or discarded.')
    change.status = 'rejected'
    return change
  })

/** Puts back the routes from before the change. Only the latest applied change of a plan can be undone. */
export const undoChange = (changeId: PlanChangeId) =>
  mutate((db) => {
    const change = must(db.plan_change, changeId, 'change')
    const plan = must(db.plan, change.planId, 'plan')
    editable(plan)
    const latest = db.plan_change
      .filter((c) => c.planId === plan.id && c.status === 'applied')
      .reduce<PlanChange | null>((last, c) => (!last || c.createdAt >= last.createdAt ? c : last), null)
    if (change.status !== 'applied') throw new Error('Only an applied change can be undone.')
    if (latest?.id !== change.id) throw new Error('Undo the later changes first.')
    if (!change.before) throw new Error('This change is too old to undo.')
    storeRoutes(db, plan.id, change.before)
    Object.assign(plan, change.before.rules, { version: plan.version + 1 })
    change.status = 'undone'
    return viewOf(db, plan.id)
  })

/** Sends each route: to the app for drivers who have it, otherwise as a link by SMS or WhatsApp. */
export const sendPlan = (planId: PlanId, options: SendOptions) =>
  mutate((db): SendResult => {
    const plan = must(db.plan, planId, 'plan')
    editable(plan)
    const sentAt = now()
    const dispatches: Dispatch[] = []
    const unreachable: SendResult['unreachable'] = []
    for (const route of db.route.filter((r) => r.planId === planId)) {
      const driver = must(db.driver, route.driverId, 'driver')
      const channel: DispatchChannel | null = driver.hasApp ? 'app' : driver.phone ? options.linkChannel : null
      if (!channel) {
        unreachable.push(driver.id)
        continue
      }
      dispatches.push({
        id: newId('dispatch'),
        planId,
        driverId: driver.id,
        channel,
        linkToken: crypto.randomUUID().slice(0, 8),
        routeVersion: plan.version,
        sentAt,
      })
    }
    db.dispatch.push(...dispatches)
    plan.status = 'sent'
    plan.notify = { customers: options.notifyCustomers, onChange: options.notifyOnChange }
    return { dispatches, unreachable }
  })

export const listDispatches = (planId: PlanId) => query((db) => db.dispatch.filter((d) => d.planId === planId))
