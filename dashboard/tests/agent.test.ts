// Tests for the dispatch agent in src/api/mock/agent*.ts. Run with `npm test`.
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

const { setMockLatency, readDb, writeDb } = await import('../src/api/mock/db.ts')
const { interpret, interpretMessage, splitClauses, readSetup, findTimeRange } = await import('../src/api/mock/agentLanguage.ts')
const { draftFrom, draftQuestions, describeFleet, describeDepot, describeBusiness } = await import('../src/api/mock/agentSetup.ts')
const { askAgent, watchDay, respond } = await import('../src/api/mock/agent.ts')
const { getToday, orderReview, locationFixes, snapshotOf, todayStage, incidentMessageId } = await import('../src/api/mock/agentToday.ts')
const { listAgentMessages } = await import('../src/api/mock/agentMessage.ts')
const { listDepots } = await import('../src/api/mock/depot.ts')
const { listDrivers, updateDriver } = await import('../src/api/mock/driver.ts')
const { listVehicles } = await import('../src/api/mock/vehicle.ts')
const { listOrders } = await import('../src/api/mock/order.ts')
const { getCurrentPlan, listPlanChanges, proposeChange, sendPlan } = await import('../src/api/mock/plan.ts')
const { startDay } = await import('../src/api/mock/liveDay.ts')
const { resetDemo, getSampleOrdersFile } = await import('../src/api/mock/workspace.ts')
const { sampleDb } = await import('../src/api/mock/seed.ts')

setMockLatency(0)
beforeEach(() => store.clear())

const DESCRIPTION =
  "We're a food delivery kitchen at Jl. Layur VII, Yogyakarta. 10 drivers on motorbikes, 08:00 to 16:00 with a half-hour lunch around noon. Each bike carries 10 boxes."

const ctx = {
  drivers: [
    { id: 'driver_a' as never, name: 'Driver 001' },
    { id: 'driver_b' as never, name: 'Driver 002' },
    { id: 'driver_c' as never, name: 'Driver 003' },
    { id: 'driver_budi' as never, name: 'Budi Santoso' },
    { id: 'driver_sari' as never, name: 'Sari Wulandari' },
  ],
  orders: [
    { id: 'order_kedai' as never, customer: 'Kedai Kanjeng Mami' },
    { id: 'order_mekar' as never, customer: 'Warung Mekar Sari' },
    { id: 'order_dunkin' as never, customer: "Dunkin'" },
  ],
}
const kinds = (text: string) => interpretMessage(text, ctx).map((i) => i.kind)
const lastAgent = async () => (await listAgentMessages()).filter((m) => m.role === 'agent').at(-1)!
const agentText = async (since: number) =>
  (await listAgentMessages())
    .slice(since)
    .filter((m) => m.role === 'agent')
    .map((m) => m.text)
    .join('\n\n')
const stage = async () => (await getToday()).stage

test('the first-day description reads into every setup field', () => {
  const [intent] = interpretMessage(DESCRIPTION, ctx)
  assert.equal(intent.kind, 'describe_operation')
  assert.deepEqual(intent.kind === 'describe_operation' && intent.setup, {
    business: 'food',
    address: 'Jl. Layur VII, Yogyakarta',
    drivers: 10,
    vehicleKind: 'motorbike',
    shift: { start: 480, end: 960 },
    break: { minutes: 30, around: 720 },
    capacity: 10,
  })
})

test('an Indonesian description with dotted times and Indonesian words reads the same way', () => {
  const setup = readSetup('Kami dapur katering di Jl. Prawirotaman No.17, Yogyakarta, 10 kurir naik motor, jam 08.00 sampai 16.00, istirahat setengah jam sekitar jam 12, tiap motor muat 10 kotak')
  assert.deepEqual(setup, {
    business: 'food',
    address: 'Jl. Prawirotaman No.17, Yogyakarta',
    drivers: 10,
    vehicleKind: 'motorbike',
    capacity: 10,
    break: { minutes: 30, around: 720 },
    shift: { start: 480, end: 960 },
  })
})

test('time ranges read in the formats kitchens type, and counts are not mistaken for times', () => {
  assert.deepEqual(findTimeRange('08:00 to 16:00'), { start: 480, end: 960 })
  assert.deepEqual(findTimeRange('08.00-16.00'), { start: 480, end: 960 })
  assert.deepEqual(findTimeRange('8am to 4pm'), { start: 480, end: 960 })
  assert.deepEqual(findTimeRange('from 8 to 4'), { start: 480, end: 960 })
  assert.deepEqual(findTimeRange('jam 7 sampai 15'), { start: 420, end: 900 })
  assert.deepEqual(findTimeRange('between 11:30 and 13:00'), { start: 690, end: 780 })
  assert.equal(findTimeRange('1 to 2 boxes'), null)
  assert.equal(findTimeRange('10 drivers'), null)
})

test('a fleet with no break, vans, and a stated capacity', () => {
  assert.deepEqual(readSetup('8am to 4pm, 2 vans, each van carries 80 boxes, no lunch break'), {
    drivers: 2,
    vehicleKind: 'van',
    capacity: 80,
    break: null,
    shift: { start: 480, end: 960 },
  })
})

test('clauses split at sentence ends but not inside "Jl." or "No.12"', () => {
  assert.deepEqual(splitClauses('Depot at Jl. Kaliurang Km. 7 Gg. Mawar No.3. Send it! ok?'), ['Depot at Jl. Kaliurang Km. 7 Gg. Mawar No.3', 'Send it', 'ok'])
})

test('requests from the designs map to their intents', () => {
  assert.deepEqual(interpretMessage('Kedai Kanjeng Mami should go with Driver 003, they know the owner. And keep Driver 001 off the toll road.', ctx), [
    { kind: 'move_stop', orderId: 'order_kedai', toDriverId: 'driver_c' },
    { kind: 'unsupported', topic: 'toll_roads' },
  ])
  const table: [string, string][] = [
    ['They come back to reload, that\'s normal for us', 'allow_reloads'],
    ['One trip per driver', 'allow_reloads'],
    ['Fewer drivers?', 'set_goal'],
    ['Finish earlier', 'finish_earlier'],
    ['Send to drivers', 'send_plan'],
    ['Send now', 'send_now'],
    ['Kirim sekarang', 'send_now'],
    ['Looks right, continue', 'confirm'],
    ['Not yet', 'cancel'],
    ['Skip it today', 'skip_order'],
    ['Pin it on the map', 'pin_on_map'],
    ['Plan 180 orders', 'plan'],
    ['Apply change', 'apply'],
    ['Reassign 2 stops', 'apply'],
    ['Leave it', 'discard'],
    ['Discard', 'discard'],
    ['Text the customers', 'notify_customers'],
    ['Start the day', 'start_day'],
    ['Just today', 'set_scope'],
    ['Always', 'set_scope'],
    ['Why does it look like this?', 'explain'],
    ['What can you do?', 'help'],
    ['Use the sample orders', 'use_sample'],
    ['Fix the addresses', 'fix_addresses'],
  ]
  for (const [text, kind] of table) assert.deepEqual(kinds(text), [kind], text)
})

test('drivers resolve by number or name, and a customer name never reads as a driver', () => {
  assert.deepEqual(interpret('Warung Mekar Sari should go with Budi', ctx), { kind: 'move_stop', orderId: 'order_mekar', toDriverId: 'driver_budi' })
  assert.deepEqual(interpret("Give Dunkin' to driver 5", ctx), { kind: 'move_stop', orderId: 'order_dunkin', toDriverId: 'driver_sari' })
  assert.deepEqual(interpret('Always keep Kedai Kanjeng Mami with Sari', ctx), { kind: 'pin_rule', orderId: 'order_kedai', driverId: 'driver_sari' })
  assert.deepEqual(interpret('Budi is sick today', ctx), { kind: 'remove_driver_today', driverId: 'driver_budi' })
  assert.deepEqual(interpret('Take Driver 002 off today', ctx), { kind: 'remove_driver_today', driverId: 'driver_b' })
})

test('names that do not exist and text no rule knows get answers, not errors', () => {
  assert.deepEqual(interpret('Driver 12 is off', ctx), { kind: 'missing', noun: 'driver', text: 'Driver 12' })
  assert.deepEqual(interpret('Move Toko Antah to Driver 003', ctx), { kind: 'missing', noun: 'stop', text: 'toko antah' })
  assert.deepEqual(interpretMessage('the weather is nice', ctx), [{ kind: 'unknown', text: 'the weather is nice' }])
  assert.deepEqual(interpretMessage('', ctx), [])
  assert.deepEqual(interpretMessage('here you go', ctx, { files: 1 }), [{ kind: 'import_orders' }])
})

test('the draft fills what the description leaves out and says so', () => {
  const draft = draftFrom([readSetup(DESCRIPTION.split('. ').slice(1).join('. '))])
  assert.equal(draft.address, null)
  assert.deepEqual(draftQuestions(draft), ['Where do your drivers load? Tell me the street and the area.'])
  assert.deepEqual(draft.break, { window: { start: 720, end: 780 }, minutes: 30 })
  assert.ok(draft.assumptions.includes('I assumed the break can start any time 12:00–13:00'))
  const bare = draftFrom([{ drivers: 4 }])
  assert.deepEqual(bare.assumptions, ['I assumed everyone rides a motorbike', 'I assumed each motorbike carries 10 boxes', 'I assumed shifts run 08:00–16:00'])
})

test('a later description changes only what it says, and a break detail keeps the break time', () => {
  const draft = draftFrom([readSetup(DESCRIPTION), readSetup('Make it 8 drivers'), readSetup('Lunch takes 45 minutes')])
  assert.equal(draft.drivers, 8)
  assert.deepEqual(draft.break, { window: { start: 720, end: 780 }, minutes: 45 })
  assert.equal(draft.capacity, 10)
})

test('the sentences a draft edit sends read back as the same draft', () => {
  const draft = draftFrom([readSetup(DESCRIPTION)])
  const again = draftFrom([readSetup(describeBusiness(draft.business)), readSetup(describeDepot('Jl. Layur VII, Yogyakarta')), readSetup(describeFleet(draft))])
  assert.deepEqual({ ...again, assumptions: [] }, { ...draft, assumptions: [] })
  const vans = { ...draft, drivers: 1, vehicleKind: 'van' as const, capacity: 60, break: null }
  assert.deepEqual(draftFrom([readSetup(describeFleet(vans))]), { ...draftFrom([{}]), ...vans, address: null, geocode: null, business: 'general', assumptions: [] })
})

test('the agent fixes doubtful addresses near the depot and leaves the ones it cannot place', async () => {
  const db = sampleDb('2026-11-21' as never, '2026-11-21T06:00:00.000Z')
  const fixes = locationFixes(db.order, db.depot[0])
  const customer = (id: string) => db.order.find((o) => o.id === id)!.customer
  assert.deepEqual(fixes.map((f) => customer(f.orderId)), ['Toko Sinar Jaya', 'Bu Ratna', 'Kopi Lor'])
  const ratna = fixes.find((f) => customer(f.orderId) === 'Bu Ratna')!
  assert.deepEqual(ratna.fix, { kind: 'candidate', index: 0 }, 'Banguntapan is nearer the kitchen than Sedayu')
  const review = orderReview(db.order)
  assert.equal(review.needsYou.map((r) => r.order.customer).join(), 'Pak Hadi')
  assert.equal(review.check.length, 3)
  assert.equal(review.ready, 176)
})

test('the whole first day runs through the agent, from a description to the live day', async () => {
  assert.equal((await stage()).kind, 'describe')

  const sample = await getSampleOrdersFile()
  await askAgent({ text: DESCRIPTION, files: [sample] })
  let today = await stage()
  assert.equal(today.kind, 'draft')
  const draftReply = (await lastAgent()).text
  assert.match(draftReply, /Nothing is saved until you confirm/)
  assert.match(draftReply, /\? I placed Jl\. Layur VII, Yogyakarta on Jl\. Layur, Mantrijeron, Yogyakarta, the closest match I found/)
  assert.match(draftReply, /✓ Named the drivers Driver 001 – 010/)
  assert.match(draftReply, /\? I assumed the break can start any time 12:00–13:00/)
  assert.match(draftReply, /Your orders file is attached too/)
  assert.equal((await listDepots()).length, 0, 'nothing is saved before the dispatcher confirms')

  await askAgent({ text: 'Make it 9 drivers' })
  today = await stage()
  assert.ok(today.kind === 'draft' && today.draft.drivers === 9)

  let seen = (await listAgentMessages()).length
  await askAgent({ text: 'Looks right, continue' })
  assert.equal((await listDepots()).length, 1)
  assert.equal((await listVehicles()).length, 9)
  assert.deepEqual((await listDrivers()).map((d) => d.name).slice(0, 2), ['Driver 001', 'Driver 002'])
  assert.equal((await listOrders()).length, 180)
  let said = await agentText(seen)
  assert.match(said, /I read orders-21-nov\.csv\. Columns mapped: Nama Pelanggan → Customer, Alamat → Address/)
  assert.match(said, /176 addresses found cleanly\. I fixed 3/)
  assert.match(said, /\*\*One order needs you\*\*\n"Pak Hadi" has the address "belakang masjid"/)
  today = await stage()
  assert.ok(today.kind === 'review')
  assert.equal(today.review.fixed.length, 3)
  assert.equal(today.review.needsYou[0].order.customer, 'Pak Hadi')

  const pin = await askAgent({ text: 'Pin it on the map' })
  assert.equal(pin.open?.kind, 'stop')
  assert.equal((await listOrders()).find((o) => o.id === pin.open?.orderId)?.customer, 'Pak Hadi')

  seen = (await listAgentMessages()).length
  await askAgent({ text: 'Skip it today' })
  assert.equal((await listOrders()).length, 179)
  said = await agentText(seen)
  assert.match(said, /Took Pak Hadi off today's stops/)
  assert.match(said, /Before I plan, I checked the orders against your fleet/)
  assert.match(said, /can't carry everything in one go: \d+ boxes against 90 of space/)
  today = await stage()
  assert.ok(today.kind === 'goals' && !today.capacity.fits && today.reloads)

  await askAgent({ text: 'They come back to reload, that is normal for us' })
  assert.match((await lastAgent()).text, /I'll add depot reloads/)
  await askAgent({ text: 'Aim for similar hours for every driver' })
  today = await stage()
  assert.ok(today.kind === 'goals' && today.goal === 'balance')

  seen = (await listAgentMessages()).length
  await askAgent({ text: 'Plan 179 orders' })
  const view = (await getCurrentPlan())!
  assert.equal(view.plan.goal, 'balance')
  assert.equal(view.plan.allowReloads, true)
  said = await agentText(seen)
  assert.match(said, /^Done\. 179 orders across 9 routes, every window kept, everyone back by \d\d:\d\d\./)
  assert.match(said, /\*\*Why it looks like this\*\*/)
  assert.match(said, /reload at the depot/)
  assert.equal((await stage()).kind, 'plan')

  const route = view.routes[0]
  const orderId = route.trips[0].stops[0].orderId
  const customer = (await listOrders()).find((o) => o.id === orderId)!.customer
  const target = (await listDrivers()).find((d) => d.id === view.routes[2].driverId)!
  seen = (await listAgentMessages()).length
  await askAgent({ text: `${customer} should go with ${target.name}, they know the owner. And keep Driver 001 off the toll road.` })
  let changes = await listPlanChanges(view.plan.id)
  assert.equal(changes.length, 1)
  assert.equal(changes[0].authorKind, 'agent')
  assert.equal(changes[0].status, 'proposed')
  assert.deepEqual(changes[0].diff, [{ kind: 'move_stop', orderId, fromDriverId: route.driverId, toDriverId: target.id }])
  const proposalMessage = (await listAgentMessages()).find((m) => m.proposalId === changes[0].id)!
  assert.match(proposalMessage.text, /Nothing moves until you apply it/)
  assert.deepEqual(proposalMessage.suggestions, ['Just today', 'Always'])
  assert.match(await agentText(seen), /Toll roads aren't on the map/)
  today = await stage()
  assert.ok(today.kind === 'plan' && today.proposal?.id === changes[0].id)
  assert.equal((await getCurrentPlan())!.plan.version, 1, 'nothing changes until the dispatcher applies')

  await askAgent({ text: 'Always' })
  changes = await listPlanChanges(view.plan.id)
  assert.deepEqual(changes.map((c) => c.status), ['rejected', 'proposed'])
  assert.deepEqual(changes[1].diff, [{ kind: 'pin_stop', orderId, driverId: target.id }])

  await askAgent({ text: 'Apply change' })
  const applied = (await getCurrentPlan())!
  assert.deepEqual(applied.plan.pins, [{ orderId, driverId: target.id }])
  assert.ok(applied.routes.find((r) => r.driverId === target.id)!.trips.some((t) => t.stops.some((x) => x.orderId === orderId)))

  await askAgent({ text: 'Send to drivers' })
  today = await stage()
  assert.ok(today.kind === 'send')
  assert.equal(today.send.unreachable.length, 9, 'drivers the agent created have no phone number yet')
  assert.match((await lastAgent()).text, /I'm missing phone numbers for Driver 001, /)
  await askAgent({ text: 'Not yet' })
  assert.equal((await stage()).kind, 'plan')
  assert.match((await lastAgent()).text, /nothing went out/)

  await askAgent({ text: 'Send to drivers' })
  await askAgent({ text: 'Send now' })
  assert.equal((await stage()).kind, 'send', 'nothing goes out while no driver can get a route')
  assert.match((await lastAgent()).text, /^No driver can get a route yet/)
  const drivers = await listDrivers()
  for (const [i, d] of drivers.slice(1).entries()) await updateDriver(d.id, { phone: `+62 812 555 ${i}` })
  await askAgent({ text: 'Send now' })
  today = await stage()
  assert.ok(today.kind === 'sent')
  const log = (await listAgentMessages()).filter((m) => m.kind === 'event')
  assert.equal(log.at(-1)!.text, 'Sent 8 routes: 8 by WhatsApp link.')
  assert.match((await listAgentMessages()).at(-2)!.text, /^Driver 001 has no phone number, so they didn't get a route/)

  await askAgent({ text: 'Start the day' })
  today = await stage()
  assert.ok(today.kind === 'live')
  assert.match((await listAgentMessages()).filter((m) => m.kind === 'event').at(-1)!.text, /^Started the day\. 9 drivers on the road from 08:00\./)

  const [incident] = today.incidents
  await watchDay(incident.at - 1)
  assert.ok(!(await listAgentMessages()).some((m) => m.id === incidentMessageId(incident)), 'the agent says nothing before the delay starts')
  await Promise.all([watchDay(incident.at + 5), watchDay(incident.at + 5)])
  await watchDay(incident.at + 30)
  const reports = (await listAgentMessages()).filter((m) => m.id === incidentMessageId(incident))
  assert.equal(reports.length, 1, 'each incident is reported once')
  assert.equal(reports[0].at, incident.at)
  assert.match(reports[0].text, /is running late on Jl\. Malioboro, about 25 min behind/)
})

test('a late driver whose stops miss their window gets a reassignment the dispatcher can apply', async () => {
  await resetDemo()
  const view = (await getCurrentPlan())!
  await sendPlan(view.plan.id, { linkChannel: 'whatsapp', notifyCustomers: false, notifyOnChange: true })
  await startDay(view.plan.id)
  const db = readDb()
  const [incident] = db.incident
  // Make the delay start before the slowed route's first stop with a window, so that stop is at risk.
  const route = db.route.find((r) => r.driverId === incident.driverId)!
  const windowed = route.trips.flatMap((t) => t.stops).find((x) => db.order.find((o) => o.id === x.orderId)!.window)!
  incident.at = windowed.eta - 30
  incident.delayMinutes = 90
  writeDb(db)

  await watchDay(incident.at + 1)
  const messages = await listAgentMessages()
  const card = messages.find((m) => m.kind === 'chat' && m.proposalId)!
  assert.match(card.text, /^\*\*\w[\w ]+ is 90 min behind\*\*\nHeld up on Jl\. Malioboro\. At this pace, \d+ orders? miss/)
  assert.match(card.suggestions[0], /^Reassign \d+ stops?$/)
  const live = await stage()
  assert.ok(live.kind === 'live' && live.proposal?.id === card.proposalId)
  const moved = live.proposal.diff.map((op) => op.kind === 'move_stop' && op.orderId)

  await askAgent({ text: 'Text the customers' })
  assert.match((await listAgentMessages()).filter((m) => m.kind === 'event').at(-1)!.text, /^Texted \d+ customers? that their delivery may be about 90 min late: /)

  await askAgent({ text: card.suggestions[0] })
  const after = (await getCurrentPlan())!
  assert.equal(after.plan.status, 'live')
  const helper = after.routes.find((r) => r.driverId !== incident.driverId && r.trips.some((t) => t.stops.some((x) => x.orderId === moved[0])))
  assert.ok(helper, 'the stops moved to another driver while the day runs')
  assert.match((await lastAgent()).text, /^Applied: Give \d+ stops? from/)
})

test('a live plan takes changes that move stops and refuses the rest', async () => {
  await resetDemo()
  const view = (await getCurrentPlan())!
  await sendPlan(view.plan.id, { linkChannel: 'whatsapp', notifyCustomers: false, notifyOnChange: true })
  await startDay(view.plan.id)
  const [from, to] = view.routes
  const orderId = from.trips[0].stops[0].orderId
  await proposeChange(view.plan.id, { authorKind: 'agent', summary: 'Move', diff: [{ kind: 'move_stop', orderId, fromDriverId: from.driverId, toDriverId: to.driverId }] })
  await assert.rejects(proposeChange(view.plan.id, { authorKind: 'agent', summary: 'Goal', diff: [{ kind: 'set_goal', goal: 'balance' }] }), /The day is running/)
})

test('on the sample plan, asking for fewer drivers previews a change and nothing moves until it is applied', async () => {
  await resetDemo()
  await askAgent({ text: 'Fewer drivers?' })
  const view = (await getCurrentPlan())!
  const [change] = await listPlanChanges(view.plan.id)
  assert.deepEqual(change.diff, [{ kind: 'set_goal', goal: 'min_drivers' }])
  assert.equal(view.plan.goal, 'min_time')
  await askAgent({ text: 'Discard' })
  assert.equal((await listPlanChanges(view.plan.id))[0].status, 'rejected')
  assert.equal((await lastAgent()).text, 'Discarded. The plan stays as it was.')
})

test('the sample plan explains itself with facts from its routes', async () => {
  await resetDemo()
  await askAgent({ text: 'Why does it look like this?' })
  const text = (await lastAgent()).text
  assert.match(text, /^\*\*Why it looks like this\*\*\n- /)
  assert.match(text, /Pak Hadi is left out: it has no place on the map\./)
})

test('anything the agent does not understand gets a next step and suggestions for the stage', async () => {
  await askAgent({ text: 'asdf qwerty' })
  const empty = await lastAgent()
  assert.match(empty.text, /^I didn't catch that\. Describe your operation/)
  await resetDemo()
  await askAgent({ text: 'the weather is nice' })
  const planned = await lastAgent()
  assert.match(planned.text, /^I didn't catch that\. The plan is ready/)
  assert.deepEqual(planned.suggestions, ['Send to drivers', 'Why does it look like this?', 'Fewer drivers?'])
})

test('a failed write is reported in the conversation instead of thrown', async () => {
  await askAgent({ text: "We're a kitchen at Jl. Nowhere 9. 3 drivers." })
  const draft = await stage()
  assert.ok(draft.kind === 'draft' && draft.questions[0].startsWith('I couldn\'t find "Jl. Nowhere 9"'))
  await askAgent({ text: 'yes' })
  assert.equal((await listDepots()).length, 0)
  assert.match((await lastAgent()).text, /I couldn't find "Jl\. Nowhere 9" on the map/)
  await assert.rejects(askAgent({ text: 'orders', files: [{ fileName: 'empty.csv', text: '' }] }), { message: 'empty.csv is empty.' })
})

test('the conversation and the stage come back the same after a reload', async () => {
  await askAgent({ text: DESCRIPTION })
  const before = { messages: await listAgentMessages(), today: await getToday() }
  const stored = store.get('nextsci.mock.v1')!
  store.clear()
  store.set('nextsci.mock.v1', stored)
  assert.deepEqual(await listAgentMessages(), before.messages)
  assert.deepEqual(await getToday(), before.today)
})

test('respond is pure: the same snapshot gives the same reply', () => {
  const db = sampleDb('2026-11-21' as never, '2026-11-21T06:00:00.000Z')
  const s = snapshotOf(db, 0)
  const intents = interpretMessage('Fewer drivers? And why?', s)
  assert.deepEqual(respond(intents, s), respond(intents, s))
  assert.equal(todayStage(s).kind, 'plan')
})
