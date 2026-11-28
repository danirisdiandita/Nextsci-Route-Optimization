import { formatDuration, formatMinute, formatMinutesDelta, formatWindow } from '../../lib/time.ts'
import type {
  AgentMessage,
  Depot,
  Driver,
  DriverId,
  Minute,
  Order,
  OrderId,
  OrderImport,
  OrderImportId,
  PlanChange,
  PlanChangeId,
  PlanChangeOp,
  PlanId,
  PlanSettings,
  PlanView,
  Route,
  UnassignedReason,
  Vehicle,
} from '../types.ts'
import { createAgentMessage, type AgentMessageInput } from './agentMessage.ts'
import { interpretMessage, type Intent, type IntentKind } from './agentLanguage.ts'
import { depotInput, draftFrom, draftQuestions, driverInputs, driverRange, vehicleInputs, vehicleLabels, type SetupDraft } from './agentSetup.ts'
import {
  goalLabels,
  incidentMessageId,
  lateStops,
  locationFixes,
  openProposal,
  orderReview,
  planSettings,
  preferencesOf,
  readSnapshot,
  sendSummary,
  todayStage,
  userChats,
  type AgentSnapshot,
  type LateStop,
  type TodayStage,
} from './agentToday.ts'
import { mutate } from './db.ts'
import { createDepot } from './depot.ts'
import { createDrivers, updateDriver } from './driver.ts'
import { startDay } from './liveDay.ts'
import { deleteOrder, fixOrderLocation, listOrders } from './order.ts'
import { commitOrderImport, createOrderImport, type ImportResult } from './orderImport.ts'
import { applyChange, createPlan, previewChange, proposeChange, rejectChange, sendPlan, type SendResult } from './plan.ts'
import { createVehicle } from './vehicle.ts'
import { getSampleOrdersFile } from './workspace.ts'

// The dispatch agent. It has no language model: agentLanguage.ts reads a message into intents, `respond`
// decides what to say and which writes to make, `perform` makes each write through the mock server's own
// functions, and `report` narrates what came back. Every step but `perform` is a pure function of a
// snapshot of the workspace (agentToday.ts), so the whole conversation is testable and replays the same way.

// ---------------------------------------------------------------------------------------------------------
// Words

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
const listNames = (names: string[]) => (names.length <= 2 ? names.join(' and ') : `${names.slice(0, -1).join(', ')}, and ${names.at(-1)}`)
const nameOf = (s: AgentSnapshot, driverId: DriverId) => s.drivers.find((d) => d.id === driverId)?.name ?? 'A removed driver'
const customerOf = (s: AgentSnapshot, orderId: OrderId) => s.orders.find((o) => o.id === orderId)?.customer ?? 'A removed stop'
const stopCount = (r: Route) => r.trips.reduce((n, t) => n + t.stops.length, 0)
const routeOf = (view: PlanView, orderId: OrderId) => view.routes.find((r) => r.trips.some((t) => t.stops.some((x) => x.orderId === orderId)))

const unassignedReasons: Record<UnassignedReason, string> = {
  no_location: 'has no place on the map',
  missed_window: "can't be reached inside its window",
  over_capacity: "doesn't fit in any vehicle",
  past_shift: 'would keep a driver past the end of the shift',
  no_driver: 'has no driver',
}

const fieldLabels: Record<string, string> = {
  customer: 'Customer',
  address: 'Address',
  phone: 'Phone',
  quantity: 'Boxes',
  window: 'Time window',
  serviceMinutes: 'Service time',
  notes: 'Notes',
}

/** Suggestions the dispatcher can pick at each stage, so a question the agent cannot answer is never a dead end. */
export function suggestionsFor(stage: TodayStage): string[] {
  switch (stage.kind) {
    case 'describe':
      return ['What can you do?']
    case 'draft':
      return stage.questions.length ? [] : ['Looks right, continue']
    case 'orders':
      return ['Use the sample orders']
    case 'review':
      return stage.review.needsYou.length ? ['Skip it today', 'Pin it on the map'] : ['Fix the addresses']
    case 'goals':
      return [`Plan ${plural(stage.review.total, 'order')}`]
    case 'plan':
      return stage.proposal ? ['Apply change', 'Discard'] : ['Send to drivers', 'Why does it look like this?', 'Fewer drivers?']
    case 'send':
      return ['Send now', 'Not yet']
    case 'sent':
      return ['Start the day']
    case 'live':
      return stage.proposal ? ['Apply change', 'Leave it'] : ['How is the day going?']
  }
}

/** One stage's next step, in a sentence. */
function nextStep(stage: TodayStage): string {
  switch (stage.kind) {
    case 'describe':
      return 'Describe your operation in a sentence or two: where your drivers load, how many there are, their hours, and what they carry.'
    case 'draft':
      return stage.questions[0] ?? 'Check the draft on Today, then confirm it.'
    case 'orders':
      return "Attach today's orders: a spreadsheet with a name and an address per stop."
    case 'review':
      return stage.review.needsYou.length ? `${stage.review.needsYou[0].order.customer} still needs a place on the map.` : 'Some addresses need a check.'
    case 'goals':
      return `Pick what the plan aims for, then I'll plan ${plural(stage.review.total, 'order')}.`
    case 'plan':
      return stage.proposal ? 'A change is waiting on Today. Apply it or discard it.' : 'The plan is ready. Send it, or tell me what to change.'
    case 'send':
      return 'Nothing goes out until you press Send.'
    case 'sent':
      return 'Start the day when your drivers leave.'
    case 'live':
      return "I'm watching the routes and will tell you when someone falls behind."
  }
}

// ---------------------------------------------------------------------------------------------------------
// Respond: what to say and what to do

/** A message the agent will post. */
export type Said = Omit<AgentMessageInput, 'role'>

const chat = (text: string, suggestions: string[] = []): Said => ({ kind: 'chat', text, suggestions })

/** A write the agent makes. `perform` runs it through the mock server's functions. */
export type Effect =
  | { kind: 'create_setup'; draft: SetupDraft }
  | { kind: 'import_orders'; importId: OrderImportId }
  | { kind: 'import_sample' }
  | { kind: 'fix_locations' }
  | { kind: 'skip_order'; orderId: OrderId }
  | { kind: 'set_driver_active'; driverId: DriverId; active: boolean }
  | { kind: 'create_plan'; settings: PlanSettings }
  | { kind: 'propose'; planId: PlanId; summary: string; diff: PlanChangeOp[]; askScope: boolean }
  | { kind: 'apply'; changeId: PlanChangeId }
  | { kind: 'reject'; changeId: PlanChangeId }
  | { kind: 'send'; planId: PlanId }
  | { kind: 'start_day'; planId: PlanId }

/** What the agent says first, then the writes it makes. `open` asks the dashboard to show a stop. */
export type Reply = { said: Said[]; effects: Effect[]; open?: { kind: 'stop'; orderId: OrderId } }

const say = (...said: Said[]): Reply => ({ said, effects: [] })
const act = (...effects: Effect[]): Reply => ({ said: [], effects })

/** The newest import the dispatcher attached to a message and that is not read yet. */
function pendingImport(s: AgentSnapshot): OrderImport | null {
  const attached = new Set(userChats(s.messages).flatMap((m) => m.attachments))
  return s.imports.filter((i) => !i.committedAt && attached.has(i.fileName)).at(-1) ?? null
}

/** A change to the draft plan, or the reason there is none. */
function propose(s: AgentSnapshot, summary: string, diff: PlanChangeOp[], askScope = false): Reply {
  const view = s.plan
  if (!view) return say(chat("There's no plan yet. Tell me to plan first, then ask again."))
  if (view.plan.status === 'sent') return say(chat('The routes already went out, so I left them as they are.'))
  const live = view.plan.status === 'live'
  if (live && !diff.every((op) => op.kind === 'move_stop' || op.kind === 'assign_stop')) {
    return say(chat('The day is running, so I can only move stops between drivers now.'))
  }
  const waiting = openProposal(s)
  if (waiting) {
    return say(chat(`"${waiting.summary}" is still waiting. Apply it or discard it first, then ask again.`, ['Apply change', 'Discard']))
  }
  return act({ kind: 'propose', planId: view.plan.id, summary, diff, askScope: askScope && !live })
}

function moveStop(s: AgentSnapshot, orderId: OrderId, toDriverId: DriverId, pin: boolean): Reply {
  const view = s.plan
  if (!view) return say(chat(`There's no plan yet. Once I plan, tell me again and I'll keep ${customerOf(s, orderId)} with ${nameOf(s, toDriverId)}.`))
  const from = routeOf(view, orderId)
  const customer = customerOf(s, orderId)
  const to = nameOf(s, toDriverId)
  if (!view.plan.driverIds.includes(toDriverId)) return say(chat(`${to} isn't on today's plan.`))
  if (from?.driverId === toDriverId && !pin) return say(chat(`${customer} is already on ${to}'s route.`))
  const diff: PlanChangeOp[] = pin
    ? [{ kind: 'pin_stop', orderId, driverId: toDriverId }]
    : from
      ? [{ kind: 'move_stop', orderId, fromDriverId: from.driverId, toDriverId }]
      : [{ kind: 'assign_stop', orderId, toDriverId }]
  const summary = pin ? `Keep ${customer} with ${to}` : from ? `Move ${customer} from ${nameOf(s, from.driverId)} to ${to}` : `Give ${customer} to ${to}`
  return propose(s, summary, diff, !pin)
}

const needsYou = (s: AgentSnapshot) => orderReview(s.orders).needsYou

type Handler<K extends IntentKind> = (intent: Extract<Intent, { kind: K }>, s: AgentSnapshot, stage: TodayStage) => Reply

/** One handler per intent, so a new intent fails the typecheck until the agent knows how to answer it. */
const handlers: { [K in IntentKind]: Handler<K> } = {
  describe_operation: (_intent, s, stage) => {
    if (stage.kind !== 'describe' && stage.kind !== 'draft') {
      return say(chat('Your depot and drivers are set up already. Change them on the Depots and Drivers pages.'))
    }
    const { setup } = preferencesOf(s.messages)
    const draft = draftFrom(setup)
    const questions = draftQuestions(draft)
    const first = stage.kind === 'describe'
    const place = draft.geocode
    const checks = [
      place?.status === 'check' && `? I placed ${draft.address} on ${place.address}, the closest match I found`,
      place && (place.status === 'ok' || place.status === 'manual') && `✓ Found ${draft.address} on the map`,
      draft.drivers !== null && `✓ Named the drivers ${driverRange(draft.drivers)}`,
      ...draft.assumptions.map((a) => `? ${a}`),
    ].filter(Boolean)
    const lines = [
      first ? 'I drafted your depot and fleet from that. Nothing is saved until you confirm.' : 'I updated the draft. Nothing is saved until you confirm.',
      checks.join('\n'),
      pendingImport(s) && "Your orders file is attached too. I'll read it once the setup is confirmed.",
      ...questions,
    ].filter(Boolean)
    return say(chat(lines.join('\n\n'), questions.length ? [] : ['Looks right, continue']))
  },
  confirm: (_intent, s, stage) => {
    switch (stage.kind) {
      case 'draft': {
        if (stage.questions.length) return say(chat(stage.questions.join('\n\n')))
        const file = pendingImport(s)
        return act({ kind: 'create_setup', draft: stage.draft }, ...(file ? [{ kind: 'import_orders', importId: file.id } as const] : []))
      }
      case 'goals':
        return handlers.plan({ kind: 'plan' }, s, stage)
      case 'send':
        return handlers.send_now({ kind: 'send_now' }, s, stage)
      case 'sent':
        return handlers.start_day({ kind: 'start_day' }, s, stage)
      case 'plan':
      case 'live':
        if (stage.proposal) return act({ kind: 'apply', changeId: stage.proposal.id })
    }
    return say(chat(`OK. ${nextStep(stage)}`, suggestionsFor(stage)))
  },
  cancel: (_intent, _s, stage) => {
    if ((stage.kind === 'plan' || stage.kind === 'live') && stage.proposal) return act({ kind: 'reject', changeId: stage.proposal.id })
    if (stage.kind === 'send') return say(chat('OK, nothing went out. The plan stays as it is.', ['Send to drivers']))
    if (stage.kind === 'draft') return say(chat('OK. Tell me what to change, or set things up by hand from Get started.'))
    return say(chat(`OK. ${nextStep(stage)}`))
  },
  use_sample: (_intent, _s, stage) => {
    if (stage.kind === 'describe' || stage.kind === 'draft') {
      return say(
        chat(
          'Press Try with sample data under the box on Today, or describe your own operation. A sentence like this is enough: "We\'re a food delivery kitchen at Jl. Layur VII, Yogyakarta. 10 drivers on motorbikes, 08:00 to 16:00."',
        ),
      )
    }
    if (stage.kind === 'orders') return act({ kind: 'import_sample' })
    return say(chat('You have orders already. Add more from the Stops page.'))
  },
  import_orders: (_intent, s, stage) => {
    const file = pendingImport(s)
    if (!file) return say(chat("I couldn't find the file you attached. Attach it again."))
    if (stage.kind === 'describe' || stage.kind === 'draft') {
      return say(chat("Your orders file is attached. I'll read it once your depot and drivers are set up."))
    }
    if (stage.kind === 'sent' || stage.kind === 'live') return say(chat('The routes already went out, so I left the file unread. Add late stops from the Stops page.'))
    return act({ kind: 'import_orders', importId: file.id })
  },
  fix_addresses: (_intent, s) => {
    const review = orderReview(s.orders)
    if (review.check.length) return act({ kind: 'fix_locations' })
    if (review.needsYou.length) return say(chat(`Every address I can place is on the map. ${review.needsYou[0].order.customer} still needs you.`, ['Skip it today', 'Pin it on the map']))
    return say(chat('Every address is on the map already.'))
  },
  skip_order: (intent, s, stage) => {
    const orderId = intent.orderId ?? needsYou(s)[0]?.order.id
    if (!orderId) return say(chat("There's no stop waiting for a decision."))
    if (stage.kind === 'sent' || stage.kind === 'live') return say(chat(`${customerOf(s, orderId)} is on a route that went out already, so I left it.`))
    return act({ kind: 'skip_order', orderId })
  },
  pin_on_map: (intent, s) => {
    const orderId = intent.orderId ?? needsYou(s)[0]?.order.id
    if (!orderId) return say(chat("There's no stop waiting for a pin."))
    return { said: [chat(`Opening ${customerOf(s, orderId)}. Drop a pin where it goes, and I'll take it from there.`)], effects: [], open: { kind: 'stop', orderId } }
  },
  allow_reloads: (intent, s, stage) => {
    if (stage.kind === 'plan') {
      if (stage.view.plan.allowReloads === intent.allow) return say(chat(intent.allow ? 'The plan already sends drivers back to reload.' : 'The plan already keeps each driver to one trip.'))
      return propose(s, intent.allow ? 'Let drivers reload at the depot' : 'One trip per driver', [{ kind: 'set_reloads', allowReloads: intent.allow }])
    }
    if (stage.kind === 'send' || stage.kind === 'sent' || stage.kind === 'live') return say(chat('The plan is set for today. I will use that for the next plan.'))
    return say(
      chat(
        intent.allow
          ? "Got it. I'll add depot reloads and remember that for every future plan."
          : "OK, one trip per driver. Stops that don't fit stay unassigned, and I'll list them.",
      ),
    )
  },
  set_goal: (intent, s, stage) => {
    if (stage.kind === 'plan') {
      if (stage.view.plan.goal === intent.goal) return say(chat(`The plan already aims for ${goalLabels[intent.goal]}.`))
      return propose(s, `Aim for ${goalLabels[intent.goal]}`, [{ kind: 'set_goal', goal: intent.goal }])
    }
    if (stage.kind === 'send' || stage.kind === 'sent' || stage.kind === 'live') return say(chat(`The plan is set for today. Next time I'll aim for ${goalLabels[intent.goal]}.`))
    return say(chat(`Got it. I'll aim for ${goalLabels[intent.goal]}.`))
  },
  finish_earlier: (_intent, s, stage) => {
    if (stage.kind !== 'plan') return handlers.set_goal({ kind: 'set_goal', goal: 'min_time' }, s, stage)
    const plan = stage.view.plan
    if (plan.goal !== 'min_time') return propose(s, `Aim for ${goalLabels.min_time}`, [{ kind: 'set_goal', goal: 'min_time' }])
    const spare = s.drivers.find((d) => !plan.driverIds.includes(d.id) && d.vehicleId)
    if (spare) return propose(s, `Add ${spare.name} to today's plan`, [{ kind: 'add_driver', driverId: spare.id }])
    const lastBack = Math.max(...stage.view.routes.map((r) => r.end))
    return say(chat(`The plan already brings everyone back as early as it can: the last driver is back at ${formatMinute(lastBack)}. Another driver would help. Add one on the Drivers page.`))
  },
  plan: (_intent, s, stage) => {
    if (stage.kind === 'sent' || stage.kind === 'live') return say(chat('The routes already went out today, so I kept the plan as it is.'))
    if (stage.kind === 'describe' || stage.kind === 'draft') return say(chat(`I need your depot and drivers first. ${nextStep(stage)}`))
    if (stage.kind === 'orders') return say(chat(`I need orders first. ${nextStep(stage)}`, suggestionsFor(stage)))
    const settings = planSettings(s, preferencesOf(s.messages))
    if (!settings) return say(chat('I need a depot, at least one active driver with a vehicle, and some orders before I can plan.'))
    return act({ kind: 'create_plan', settings })
  },
  remove_driver_today: (intent, s, stage) => {
    const name = nameOf(s, intent.driverId)
    if (stage.kind === 'plan') {
      if (!stage.view.plan.driverIds.includes(intent.driverId)) return say(chat(`${name} isn't on today's plan.`))
      return propose(s, `Plan without ${name}`, [{ kind: 'remove_driver', driverId: intent.driverId }])
    }
    if (stage.kind === 'send' || stage.kind === 'sent' || stage.kind === 'live') {
      return say(chat(`${name} already has a route. Tell me which stops to give to someone else.`))
    }
    if (!s.drivers.find((d) => d.id === intent.driverId)?.active) return say(chat(`${name} is already off today.`))
    return act({ kind: 'set_driver_active', driverId: intent.driverId, active: false })
  },
  move_stop: (intent, s) => moveStop(s, intent.orderId, intent.toDriverId, false),
  pin_rule: (intent, s, stage) => moveStop(s, intent.orderId, intent.driverId, stage.kind !== 'live'),
  set_scope: (intent, s, stage) => {
    const proposal = stage.kind === 'plan' ? stage.proposal : null
    const op = proposal?.diff.length === 1 ? proposal.diff[0] : null
    if (!proposal || !op || (op.kind !== 'move_stop' && op.kind !== 'assign_stop' && op.kind !== 'pin_stop')) {
      return say(chat("There's no change waiting for that."))
    }
    const driverId = op.kind === 'pin_stop' ? op.driverId : op.toDriverId
    if (intent.scope === 'today') {
      if (op.kind !== 'pin_stop') return say(chat('OK, just today. Apply the change when it looks right.', ['Apply change', 'Discard']))
      return {
        said: [],
        effects: [
          { kind: 'reject', changeId: proposal.id },
          ...moveStop({ ...s, changes: [] }, op.orderId, driverId, false).effects,
        ],
      }
    }
    if (op.kind === 'pin_stop') return say(chat('That change already keeps it with them.', ['Apply change', 'Discard']))
    return {
      said: [],
      effects: [{ kind: 'reject', changeId: proposal.id }, ...moveStop({ ...s, changes: [] }, op.orderId, driverId, true).effects],
    }
  },
  apply: (_intent, _s, stage) => {
    const proposal = stage.kind === 'plan' || stage.kind === 'live' ? stage.proposal : null
    return proposal ? act({ kind: 'apply', changeId: proposal.id }) : say(chat("There's no change waiting."))
  },
  discard: (_intent, _s, stage) => {
    const proposal = stage.kind === 'plan' || stage.kind === 'live' ? stage.proposal : null
    return proposal ? act({ kind: 'reject', changeId: proposal.id }) : say(chat("There's no change waiting."))
  },
  send_plan: (_intent, s, stage) => {
    if (stage.kind === 'sent' || stage.kind === 'live') return say(chat('The routes went out already.'))
    if (stage.kind === 'plan' && stage.proposal) return say(chat(`"${stage.proposal.summary}" is still waiting. Apply it or discard it first.`, ['Apply change', 'Discard']))
    if (stage.kind !== 'plan' && stage.kind !== 'send') return say(chat(`There's nothing to send yet. ${nextStep(stage)}`))
    const { app, link, unreachable } = sendSummary(s)
    const lines = [
      app.length && link.length
        ? `${listNames(app.map((d) => d.name))} ${app.length === 1 ? 'has' : 'have'} the app, so their route goes straight to it. I'll send the other ${plural(link.length, 'driver')} a WhatsApp link that opens their route.`
        : app.length
          ? 'Every driver has the app, so each route goes straight to it.'
          : link.length
            ? `None of your drivers has the app yet, so I'll send ${link.length === 1 ? 'your driver' : `all ${link.length}`} a WhatsApp link that opens their route. Opening it installs nothing.`
            : '',
      unreachable.length &&
        `I'm missing phone numbers for ${listNames(unreachable.map((d) => d.name))}. Add them on Today, or they won't get their route.`,
      'Nothing goes out until you press Send.',
    ].filter(Boolean)
    return say(chat(lines.join('\n\n'), ['Send now', 'Not yet']))
  },
  send_now: (_intent, s, stage) => {
    if (stage.kind === 'sent' || stage.kind === 'live') return say(chat('The routes went out already.'))
    if (stage.kind === 'plan' && stage.proposal) return say(chat(`"${stage.proposal.summary}" is still waiting. Apply it or discard it first.`, ['Apply change', 'Discard']))
    if (stage.kind !== 'plan' && stage.kind !== 'send') return say(chat(`There's nothing to send yet. ${nextStep(stage)}`))
    const { app, link } = sendSummary(s)
    if (!app.length && !link.length) {
      return say(chat("No driver can get a route yet: none has the app or a phone number. Add their numbers on Today, then send.", ['Send to drivers']))
    }
    return act({ kind: 'send', planId: s.plan!.plan.id })
  },
  start_day: (_intent, s, stage) => {
    if (stage.kind === 'live') return say(chat('The day is running already.'))
    if (stage.kind !== 'sent') return say(chat(`Send the routes before you start the day. ${nextStep(stage)}`))
    return act({ kind: 'start_day', planId: s.plan!.plan.id })
  },
  notify_customers: (_intent, s, stage) => {
    if (stage.kind !== 'live') return say(chat("No customer's delivery is running late right now, so there's nothing to tell them."))
    // The stops the agent flagged in its proposal, or else every stop at risk now.
    const flagged = stage.proposal?.diff.flatMap((op) => (op.kind === 'move_stop' ? [op.orderId] : [])) ?? []
    const orderIds = flagged.length ? flagged : lateAll(s).map((l) => l.orderId)
    if (!orderIds.length) return say(chat("No customer's delivery is running late right now, so there's nothing to tell them."))
    const delayOf = (orderId: OrderId) => {
      const driverId = routeOf(stage.view, orderId)?.driverId
      return s.incidents.filter((i) => i.driverId === driverId).reduce((n, i) => n + i.delayMinutes, 0)
    }
    const delay = Math.max(...orderIds.map(delayOf))
    return say({
      kind: 'event',
      text: `Texted ${plural(orderIds.length, 'customer')} that their delivery may be about ${delay} min late: ${listNames(orderIds.map((id) => customerOf(s, id)))}.`,
      at: Math.floor(s.minute),
    })
  },
  explain: (_intent, s, stage) => say(chat(explanation(s, stage), suggestionsFor(stage))),
  help: (_intent, _s, stage) =>
    say(
      chat(
        [
          'I set up your depot and drivers from a description, read your orders file and fix the addresses I can, plan the day, change routes when you ask, send them, and watch the live day.',
          nextStep(stage),
        ].join('\n\n'),
        suggestionsFor(stage),
      ),
    ),
  unsupported: () => say(chat("Toll roads aren't on the map in this workspace, so I can't route around them yet. I can move stops between drivers or take a driver off today.")),
  missing: (intent, s) => {
    if (intent.noun === 'driver') {
      const names = s.drivers.map((d) => d.name)
      return say(chat(`I couldn't find ${intent.text}. Your drivers are ${names.length ? listNames(names.slice(0, 12)) : 'not set up yet'}.`))
    }
    return say(chat(`I couldn't find a stop called "${intent.text}". Use the customer's name as it appears on the Stops page.`))
  },
  unknown: (_intent, _s, stage) => say(chat(`I didn't catch that. ${nextStep(stage)}`, suggestionsFor(stage))),
}

/** Late stops across the live plan at the current minute. */
const lateAll = (s: AgentSnapshot): LateStop[] =>
  (s.plan?.routes ?? []).flatMap((r) => lateStops(r, s.incidents, s.orders, s.minute))

/** A file sent with a description waits for the setup, which the description's reply already says. */
const withoutEcho = (intents: Intent[]) =>
  intents.some((i) => i.kind === 'describe_operation') ? intents.filter((i) => i.kind !== 'import_orders') : intents

/**
 * Decides the reply to a message. `stage` is what the dispatcher saw when they wrote it, and `s` holds the
 * message itself. Writes come one proposal at a time, so the first change waits for an answer.
 */
export function respond(intents: Intent[], s: AgentSnapshot, stage: TodayStage = todayStage(s)): Reply {
  const reply: Reply = { said: [], effects: [] }
  for (const intent of intents.length ? withoutEcho(intents) : [{ kind: 'unknown', text: '' } as const]) {
    const part = (handlers[intent.kind] as Handler<IntentKind>)(intent as never, s, stage)
    const proposing = part.effects.some((e) => e.kind === 'propose')
    if (proposing && reply.effects.some((e) => e.kind === 'propose')) {
      reply.said.push(chat("I'll take the next change once you've decided on this one."))
      continue
    }
    reply.said.push(...part.said)
    reply.effects.push(...part.effects)
    reply.open ??= part.open
  }
  return reply
}

/** Why the routes look the way they do, or what the agent is waiting for. */
export function explanation(s: AgentSnapshot, stage: TodayStage): string {
  if (stage.kind === 'plan' || stage.kind === 'send' || stage.kind === 'sent') return ['**Why it looks like this**', planFacts(s, stage.view).map((f) => `- ${f}`).join('\n')].join('\n')
  if (stage.kind === 'goals') {
    const c = stage.capacity
    return c.fits
      ? `Your ${c.vehicleNoun} carry ${c.perTrip} boxes in one trip, and the orders need ${c.boxes}, so everything fits. ${nextStep(stage)}`
      : `The orders need ${c.boxes} boxes, and your ${plural(c.vehicles, 'vehicle')} carry ${c.perTrip} per trip. With reloads each driver makes about ${plural(c.tripsEach, 'trip')}. ${nextStep(stage)}`
  }
  if (stage.kind === 'live') {
    const late = lateAll(s)
    return late.length ? `${plural(late.length, 'stop')} may miss their window at the current pace.` : 'Every stop is on track for its window.'
  }
  return nextStep(stage)
}

/** Plain facts about a plan, each from the routes: trips, the busiest area, breaks, who finishes last, what is left out. */
export function planFacts(s: AgentSnapshot, view: PlanView): string[] {
  const facts: string[] = []
  const routes = view.routes
  if (!routes.length) return ['No route could be built. Check that your drivers have vehicles and their shifts overlap the depot hours.']
  const reloading = routes.filter((r) => r.trips.length > 1)
  if (reloading.length) {
    const most = Math.max(...routes.map((r) => r.trips.length))
    facts.push(`${plural(reloading.length, 'driver')} reload at the depot, up to ${plural(most, 'trip')} each, because one load can't carry all their boxes.`)
  }
  const areaOf = (orderId: OrderId) => {
    const g = s.orders.find((o) => o.id === orderId)?.geocode
    return g && g.status !== 'not_found' ? (g.address.split(', ').at(-2) ?? null) : null
  }
  const areas = new Map<string, { stops: number; drivers: Set<DriverId> }>()
  for (const r of routes) {
    for (const t of r.trips) {
      for (const stop of t.stops) {
        const area = areaOf(stop.orderId)
        if (!area) continue
        const entry = areas.get(area) ?? { stops: 0, drivers: new Set() }
        entry.stops++
        entry.drivers.add(r.driverId)
        areas.set(area, entry)
      }
    }
  }
  const [busiest] = [...areas.entries()].sort((a, b) => b[1].stops - a[1].stops)
  if (busiest && busiest[1].drivers.size > 1) {
    facts.push(`${busiest[0]} has the most stops (${busiest[1].stops}), so it's split across ${plural(busiest[1].drivers.size, 'driver')}.`)
  }
  const breaks = routes.flatMap((r) => (r.break ? [r.break.start] : []))
  if (breaks.length) {
    const [first, last] = [Math.min(...breaks), Math.max(...breaks)]
    facts.push(first === last ? `Every break starts at ${formatMinute(first)}.` : `Breaks fall between ${formatMinute(first)} and ${formatMinute(last)}, between trips where they fit.`)
  }
  const durations = routes.map((r) => r.durationMin)
  facts.push(`Days run from ${formatDuration(Math.min(...durations))} to ${formatDuration(Math.max(...durations))}, with the goal set to ${goalLabels[view.plan.goal]}.`)
  for (const reason of new Set(view.unassigned.map((u) => u.reason))) {
    const names = view.unassigned.filter((u) => u.reason === reason).map((u) => customerOf(s, u.orderId))
    const who = `${listNames(names.slice(0, 3))}${names.length > 3 ? ` and ${names.length - 3} more` : ''}`
    facts.push(`${who} ${names.length === 1 ? 'is' : 'are'} left out: ${names.length === 1 ? 'it' : 'each'} ${unassignedReasons[reason]}.`)
  }
  return facts
}

// ---------------------------------------------------------------------------------------------------------
// Perform: each write through the mock server's functions

/** What a write gave back, for the agent to report. */
export type Outcome =
  | { kind: 'set_up'; depot: Depot; vehicles: Vehicle[]; drivers: Driver[] }
  | { kind: 'imported'; orderImport: OrderImport; result: ImportResult; fixed: number }
  | { kind: 'fixed'; fixed: number }
  | { kind: 'skipped'; customer: string }
  | { kind: 'driver_active'; driver: Driver }
  | { kind: 'planned'; view: PlanView }
  /** `leftOut`: stops the change would leave unassigned. */
  | { kind: 'proposed'; change: PlanChange; askScope: boolean; leftOut: { orderId: OrderId; reason: UnassignedReason }[] }
  | { kind: 'applied'; change: PlanChange; view: PlanView }
  | { kind: 'rejected'; change: PlanChange }
  | { kind: 'sent'; result: SendResult }
  | { kind: 'started'; view: PlanView }
  | { kind: 'failed'; doing: string; message: string }

const doing: Record<Effect['kind'], string> = {
  create_setup: 'save the setup',
  import_orders: 'read the orders file',
  import_sample: 'load the sample orders',
  fix_locations: 'fix the addresses',
  skip_order: 'take that stop off today',
  set_driver_active: 'change the driver',
  create_plan: 'plan the day',
  propose: 'prepare that change',
  apply: 'apply the change',
  reject: 'discard the change',
  send: 'send the routes',
  start_day: 'start the day',
}

async function fixAll(orders: Order[], depot: Depot | undefined): Promise<number> {
  if (!depot) return 0
  const fixes = locationFixes(orders, depot)
  for (const { orderId, fix } of fixes) await fixOrderLocation(orderId, fix)
  return fixes.length
}

async function importAndFix(importId: OrderImportId, s: AgentSnapshot): Promise<Outcome> {
  const result = await commitOrderImport(importId, { rememberMapping: true })
  const orderImport = s.imports.find((i) => i.id === importId)!
  return { kind: 'imported', orderImport, result, fixed: await fixAll(result.orders, s.depots[0]) }
}

/** Runs one write. The snapshot is the one `respond` decided from, refreshed after earlier writes. */
export async function perform(effect: Effect, s: AgentSnapshot): Promise<Outcome> {
  switch (effect.kind) {
    case 'create_setup': {
      const depot = s.depots[0] ?? (await createDepot(depotInput(effect.draft)!))
      const vehicles: Vehicle[] = []
      for (const input of vehicleInputs(effect.draft, depot.id)) vehicles.push(await createVehicle(input))
      const drivers = await createDrivers(driverInputs(effect.draft, vehicles.map((v) => v.id), s.drivers.length + 1))
      return { kind: 'set_up', depot, vehicles, drivers }
    }
    case 'import_orders':
      return importAndFix(effect.importId, s)
    case 'import_sample': {
      const file = await getSampleOrdersFile()
      const orderImport = await createOrderImport(file.fileName, file.text)
      return importAndFix(orderImport.id, { ...s, imports: [...s.imports, orderImport] })
    }
    case 'fix_locations':
      return { kind: 'fixed', fixed: await fixAll(await listOrders(), s.depots[0]) }
    case 'skip_order': {
      const customer = customerOf(s, effect.orderId)
      await deleteOrder(effect.orderId)
      return { kind: 'skipped', customer }
    }
    case 'set_driver_active':
      return { kind: 'driver_active', driver: await updateDriver(effect.driverId, { active: effect.active }) }
    case 'create_plan':
      return { kind: 'planned', view: await createPlan(effect.settings) }
    case 'propose': {
      const preview = await previewChange(effect.planId, effect.diff)
      const before = new Set(s.plan?.unassigned.map((u) => u.orderId))
      const leftOut = preview.unassigned.filter((u) => !before.has(u.orderId)).map(({ orderId, reason }) => ({ orderId, reason }))
      const change = await proposeChange(effect.planId, { authorKind: 'agent', summary: effect.summary, diff: effect.diff })
      return { kind: 'proposed', change, askScope: effect.askScope && !leftOut.length, leftOut }
    }
    case 'apply': {
      const view = await applyChange(effect.changeId)
      return { kind: 'applied', change: s.changes.find((c) => c.id === effect.changeId)!, view }
    }
    case 'reject':
      return { kind: 'rejected', change: await rejectChange(effect.changeId) }
    case 'send':
      return { kind: 'sent', result: await sendPlan(effect.planId, { linkChannel: 'whatsapp', notifyCustomers: false, notifyOnChange: true }) }
    case 'start_day':
      return { kind: 'started', view: await startDay(effect.planId) }
  }
}

// ---------------------------------------------------------------------------------------------------------
// Report: what the agent says about each write, from the workspace after it

function impactSentence(s: AgentSnapshot, change: PlanChange, leftOut: { orderId: OrderId; reason: UnassignedReason }[] = []): string {
  const parts = change.impact.drivers
    .filter((d) => d.end !== null && d.minutesDelta !== 0)
    .map((d) => `${nameOf(s, d.driverId)} ${formatMinutesDelta(d.minutesDelta)}`)
  const windows = change.impact.windowsHeld ? 'Every window still holds.' : `${plural(change.impact.lateStops, 'stop')} would be late.`
  const out = leftOut.map((u) => `${customerOf(s, u.orderId)} would be left out: it ${unassignedReasons[u.reason]}.`)
  return [parts.length ? `${parts.join(', ')}.` : '', windows, ...out].filter(Boolean).join(' ')
}

export function report(outcome: Outcome, s: AgentSnapshot): Said[] {
  switch (outcome.kind) {
    case 'set_up': {
      const v = outcome.vehicles[0]
      const label = v ? vehicleLabels[v.kind] : null
      const fleetText = label ? `${outcome.vehicles.length} ${outcome.vehicles.length === 1 ? label.one : label.many}` : 'no vehicles'
      const range = outcome.drivers.length ? `${outcome.drivers[0].name}${outcome.drivers.length > 1 ? ` – ${outcome.drivers.at(-1)!.name.slice(-3)}` : ''}` : 'no drivers'
      return [chat(`Saved ${outcome.depot.name}, ${fleetText}, and ${range}.`)]
    }
    case 'imported': {
      const { orderImport, result, fixed } = outcome
      const mapped = Object.entries(orderImport.mapping)
        .filter(([, index]) => index !== null)
        .map(([field, index]) => `${orderImport.columns[index!]} → ${fieldLabels[field]}`)
      const clean = result.counts.ok
      const lines = [
        `I read ${orderImport.fileName}. Columns mapped: ${mapped.join(', ')}.`,
        `${plural(clean, 'address', 'addresses')} found cleanly.${fixed ? ` I fixed ${fixed} and marked them on the map so you can check.` : ''}`,
        result.skipped.length && `I skipped ${plural(result.skipped.length, 'row')} with no name or address: row ${result.skipped.map((r) => r.row).join(', ')}.`,
        s.plan && s.plan.plan.status === 'draft' && 'Plan again to include the new stops.',
      ].filter(Boolean)
      return [chat(lines.join('\n\n'))]
    }
    case 'fixed':
      return [chat(outcome.fixed ? `I fixed ${plural(outcome.fixed, 'address', 'addresses')} and marked them on the map so you can check.` : 'Every address I can place is on the map already.')]
    case 'skipped':
      return [chat(`Took ${outcome.customer} off today's stops. Add it again from Stops once you know where it goes.`)]
    case 'driver_active':
      return [chat(outcome.driver.active ? `${outcome.driver.name} is back on today.` : `${outcome.driver.name} is off today. I'll plan without them.`)]
    case 'planned': {
      const { routes, unassigned, plan } = outcome.view
      const placed = routes.reduce((n, r) => n + stopCount(r), 0)
      const late = routes.reduce((n, r) => n + r.trips.reduce((m, t) => m + t.stops.filter((x) => x.lateMinutes > 0).length, 0), 0)
      const lastBack = routes.length ? Math.max(...routes.map((r) => r.end)) : null
      const head = [
        `Done. ${plural(placed, 'order')} across ${plural(routes.length, 'route')}`,
        late ? `${plural(late, 'stop')} late` : 'every window kept',
        lastBack !== null && `everyone back by ${formatMinute(lastBack)}`,
      ].filter(Boolean)
      const out = unassigned.length ? ` ${plural(unassigned.length, 'order')} left out.` : ''
      return [
        chat(`${head.join(', ')}.${out}`),
        chat(explanation(s, { kind: 'plan', view: outcome.view, proposal: null })),
        chat('Want me to send it, or change something first?', [plan.goal === 'min_drivers' ? 'Similar hours for everyone' : 'Fewer drivers?', 'Finish earlier', 'Send to drivers']),
      ]
    }
    case 'proposed': {
      const { change } = outcome
      const op = change.diff[0]
      const intro =
        op?.kind === 'pin_stop'
          ? `I'll keep ${customerOf(s, op.orderId)} with ${nameOf(s, op.driverId)} whenever this plan is solved again. The change is on the timeline; nothing moves until you apply it.`
          : op?.kind === 'remove_driver'
            ? `Here's the plan without ${nameOf(s, op.driverId)}, previewed on the timeline. Nothing changes until you apply it.`
            : "Here's the change, previewed on the timeline. Nothing moves until you apply it."
      const live = s.plan?.plan.status === 'live'
      const scope =
        outcome.askScope && op && (op.kind === 'move_stop' || op.kind === 'assign_stop')
          ? `Should ${customerOf(s, op.orderId)} always go with ${nameOf(s, op.toDriverId)} when I plan again, or just today?`
          : null
      const suggestions = scope ? ['Just today', 'Always'] : live ? ['Apply change', 'Leave it'] : ['Apply change', 'Discard']
      return [{ ...chat([intro, impactSentence(s, change, outcome.leftOut), scope].filter(Boolean).join('\n\n'), suggestions), proposalId: change.id }]
    }
    case 'applied': {
      const routes = outcome.view.plan.status === 'live' ? ' The drivers have the new route.' : ''
      return [chat(`Applied: ${outcome.change.summary}.${routes}`, outcome.view.plan.status === 'draft' ? ['Send to drivers'] : [])]
    }
    case 'rejected':
      return [chat('Discarded. The plan stays as it was.')]
    case 'sent': {
      const { dispatches, unreachable } = outcome.result
      const app = dispatches.filter((d) => d.channel === 'app').length
      const link = dispatches.length - app
      const how = [app && `${app} in the app`, link && `${link} by WhatsApp link`].filter(Boolean).join(', ')
      // The log reads in time order, and the day starts 10 minutes before the first driver leaves.
      const firstStart = Math.min(...(s.plan?.routes ?? []).map((r) => r.start))
      const at = Math.floor(Math.min(s.minute, firstStart - 10))
      const said: Said[] = [{ kind: 'event', text: `Sent ${plural(dispatches.length, 'route')}${how ? `: ${how}` : ''}.`, at }]
      if (unreachable.length) {
        said.push(chat(`${listNames(unreachable.map((id) => nameOf(s, id)))} ${unreachable.length === 1 ? 'has' : 'have'} no phone number, so they didn't get a route. Add a number on the Drivers page.`))
      }
      said.push(chat('Start the day when your drivers leave, and I will watch the routes.', ['Start the day']))
      return said
    }
    case 'started': {
      const first = Math.min(...outcome.view.routes.map((r) => r.start))
      return [
        { kind: 'event', text: `Started the day. ${plural(outcome.view.routes.length, 'driver')} on the road from ${formatMinute(first)}.`, at: Math.floor(s.minute) },
        chat("I'm watching the routes. When someone falls behind, I'll tell you here and suggest what to do."),
      ]
    }
    case 'failed':
      return [chat(`I couldn't ${outcome.doing}: ${outcome.message}`)]
  }
}

/** What the agent says when the day moves to a new stage, so the dispatcher always knows the next step. */
function stageIntro(stage: TodayStage): Said[] {
  switch (stage.kind) {
    case 'orders':
      return [chat("Now today's orders. Attach a spreadsheet with a name and an address per stop, or try the sample orders.", ['Use the sample orders'])]
    case 'review': {
      const [first] = stage.review.needsYou
      if (!first) return [chat(`${plural(stage.review.check.length, 'address', 'addresses')} need a check.`, ['Fix the addresses'])]
      const more = stage.review.needsYou.length > 1 ? ` ${plural(stage.review.needsYou.length - 1, 'more stop')} after this one.` : ''
      const title = stage.review.needsYou.length === 1 ? '**One order needs you**' : `**${stage.review.needsYou.length} orders need you**`
      return [chat(`${title}\n"${first.order.customer}" has the address "${first.order.addressRaw}", and no place on the map matches it. What should I do?${more}`, ['Skip it today', 'Pin it on the map'])]
    }
    case 'goals': {
      const c = stage.capacity
      const said = [chat('Before I plan, I checked the orders against your fleet.')]
      if (!c.fits) {
        said.push(
          chat(
            `Your ${c.vehicleNoun} can't carry everything in one go: ${c.boxes} boxes against ${c.perTrip} of space. With reloads at the depot, each driver makes about ${plural(c.tripsEach, 'trip')}. Is that how you work?`,
            ['Drivers return to reload', 'One trip per driver'],
          ),
        )
      } else said.push(chat(`Everything fits in one trip: ${c.boxes} boxes against ${c.perTrip} of space.`))
      said.push(chat(`I'll aim for ${goalLabels[stage.goal]}, with every window kept and everyone back by ${formatMinute(stage.backBy)}. Say if you want something else, or tell me to plan.`, [`Plan ${plural(stage.review.total, 'order')}`]))
      return said
    }
    default:
      return []
  }
}

// ---------------------------------------------------------------------------------------------------------
// The runner

export type AgentFile = { fileName: string; text: string }

/** One turn of the conversation: the dispatcher's message, the agent's replies, and a stop to show, if any. */
export type AgentTurn = { messages: AgentMessage[]; open: Reply['open'] }

/**
 * Takes a message from the dispatcher and answers it. Attached files are read first, so a broken file fails
 * before anything is saved. Then the message is saved, the agent decides, makes its writes one at a time,
 * and posts what happened. A write that fails stops the rest and is reported, never thrown.
 */
export async function askAgent({ text, files = [] }: { text: string; files?: AgentFile[] }): Promise<AgentTurn> {
  for (const f of files) await createOrderImport(f.fileName, f.text)
  const seen = await readSnapshot()
  const before = todayStage(seen)
  const asked = await createAgentMessage({ role: 'user', kind: 'chat', text, attachments: files.map((f) => f.fileName) })
  let s: AgentSnapshot = { ...seen, messages: [...seen.messages, asked] }
  let reply: Reply
  try {
    reply = respond(interpretMessage(text, s, { files: files.length }), s, before)
  } catch (error) {
    reply = say(chat(`Something went wrong on my side: ${error instanceof Error ? error.message : String(error)}`))
  }
  const said: Said[] = [...reply.said]
  for (const effect of reply.effects) {
    let outcome: Outcome
    try {
      outcome = await perform(effect, s)
    } catch (error) {
      outcome = { kind: 'failed', doing: doing[effect.kind], message: error instanceof Error ? error.message : String(error) }
    }
    s = await readSnapshot()
    said.push(...report(outcome, s))
    if (outcome.kind === 'failed') break
  }
  const after = todayStage(s)
  if (after.kind !== before.kind) said.push(...stageIntro(after))
  const messages = [asked]
  for (const m of said) messages.push(await createAgentMessage({ role: 'agent', ...m }))
  return { messages, open: reply.open }
}

/**
 * Looks at the live day at `minute` and reports each incident that has started, once. When the delay makes
 * stops miss their window, it proposes giving them to the driver with the most time to spare.
 */
export async function watchDay(minute: Minute): Promise<void> {
  const s = await readSnapshot()
  const view = s.plan
  if (view?.plan.status !== 'live') return
  for (const incident of s.incidents.filter((i) => i.at <= minute)) {
    const id = incidentMessageId(incident)
    const route = view.routes.find((r) => r.driverId === incident.driverId)
    if (!route || s.messages.some((m) => m.id === id)) continue
    const name = nameOf(s, incident.driverId)
    const late = lateStops(route, s.incidents, s.orders, Math.max(minute, incident.at))
    // Claim the incident first, in one write, so two tabs watching the same day never report it twice.
    const claimed = await mutate((db) => {
      if (db.agent_message.some((m) => m.id === id)) return false
      db.agent_message.push({
        id,
        role: 'agent',
        kind: 'event',
        text: late.length
          ? `${name} is running late on ${incident.place}, about ${incident.delayMinutes} min behind. Moving their stops changes another driver's day, so I'm asking you.`
          : `${name} is running late on ${incident.place}, about ${incident.delayMinutes} min behind. No window is at risk, so I left the route as it is.`,
        attachments: [],
        suggestions: [],
        proposalId: null,
        at: incident.at,
        createdAt: new Date().toISOString(),
      })
      return true
    })
    if (!claimed || !late.length) continue
    const helper = view.routes
      .filter((r) => r.driverId !== incident.driverId && !s.incidents.some((i) => i.driverId === r.driverId && i.at <= minute))
      .sort((a, b) => a.end - b.end)[0]
    if (!helper) continue
    const diff: PlanChangeOp[] = late.map((l) => ({ kind: 'move_stop', orderId: l.orderId, fromDriverId: incident.driverId, toDriverId: helper.driverId }))
    let change: PlanChange
    try {
      change = await proposeChange(view.plan.id, {
        authorKind: 'agent',
        summary: `Give ${plural(late.length, 'stop')} from ${name} to ${nameOf(s, helper.driverId)}`,
        diff,
      })
    } catch {
      continue
    }
    const names = late.map((l) => `${customerOf(s, l.orderId)} (${formatWindow(s.orders.find((o) => o.id === l.orderId)!.window!)})`)
    await createAgentMessage({
      role: 'agent',
      kind: 'chat',
      text: [
        `**${name} is ${incident.delayMinutes} min behind**`,
        `Held up on ${incident.place}. At this pace, ${plural(late.length, 'order')} ${late.length === 1 ? 'misses its' : 'miss their'} window: ${listNames(names)}.`,
        `Proposal: give ${late.length === 1 ? 'it' : 'them'} to ${nameOf(s, helper.driverId)}, who is back at the depot by ${formatMinute(helper.end)}. ${impactSentence(s, change)}`,
      ].join('\n'),
      suggestions: [`Reassign ${plural(late.length, 'stop')}`, 'Text the customers', 'Leave it'],
      proposalId: change.id,
      at: incident.at,
    })
  }
}
