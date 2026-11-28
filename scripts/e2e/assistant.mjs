// Walks the dispatch agent's first day in Chrome over the DevTools protocol (designs NS 01 to NS 08): describe
// the operation, confirm the draft, review the orders, pick the goals, plan, change a route by asking, send,
// and watch the live day. Clicks and typing are real input events. Checks that it all survives a reload.
//   node scripts/e2e/assistant.mjs <chrome-debug-port> <dashboard-url> <screenshot-dir> <email> <password>
// scripts/e2e-dashboard.sh runs it after the tour. Set COLOR_SCHEME=light or dark for the screenshots.
import { writeFileSync } from 'node:fs'

const [port, base, out, email, password] = process.argv.slice(2)
const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json()
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((r) => ws.addEventListener('open', r, { once: true }))
let id = 0
const pending = new Map()
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
})
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const js = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value
const until = async (expr, ms = 15000) => {
  for (const end = Date.now() + ms; Date.now() < end; await sleep(100)) if (await js(`!!(${expr})`)) return true
  return false
}
const main = () => js('document.querySelector("main")?.innerText.replace(/\\s+/g, " ").trim() ?? ""')
const panel = () => js('document.querySelector("aside[aria-label=\'Dispatch agent\']")?.innerText.replace(/\\s+/g, " ").trim() ?? ""')
const go = async (path) => { await send('Page.navigate', { url: new URL(path, base).href }); await sleep(300); await until('document.querySelector("form, [data-slot=sidebar-wrapper]")') }
const shot = async (name) => { await sleep(500); const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(`${out}/${name}.png`, Buffer.from(r.result.data, 'base64')) }
const mock = (module, call) => js(`import('/src/api/mock/${module}.ts').then((m) => ${call}).then((r) => JSON.parse(JSON.stringify(r ?? null)))`)
// An element found by its visible text inside `scope`, as a page expression.
const byText = (scope, text) => `[...document.querySelectorAll(${JSON.stringify(scope)})].find((e) => e.textContent.trim() === ${JSON.stringify(text)} && !e.disabled)`
// Clicks with real mouse events after scrolling the element into view.
const clickAt = async (expr) => {
  const at = await js(`(() => { const el = ${expr}; if (!el) return null; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
  if (!at) return false
  for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, ...at, button: 'left', clickCount: 1 })
  return true
}
const click = async (scope, text) => {
  const ok = await until(byText(scope, text))
  return ok && clickAt(byText(scope, text))
}
// Types like a person: focus the field, select what is there, and insert the text.
const type = async (selector, text) => {
  await clickAt(`document.querySelector(${JSON.stringify(selector)})`)
  await js(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.focus(); el.select?.(); return true })()`)
  await send('Input.insertText', { text })
}
const pressEnter = async () => {
  for (const t of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type: t, key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
}
const agentIdle = () => until('!document.querySelector("aside [role=status]")', 20000)
// Says something to the agent in the panel's composer and waits for its answer.
const tell = async (text) => {
  await type('aside textarea', text)
  await pressEnter()
  await sleep(300)
  await agentIdle()
}

let failed = 0
const check = async (name, holds, detail = async () => '') => {
  let ok = false
  for (const end = Date.now() + 8000; !(ok = Boolean(await holds())) && Date.now() < end; ) await sleep(150)
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `  (${await detail()})`}`)
  if (!ok) failed++
}

const features = [{ name: 'prefers-reduced-motion', value: 'reduce' }]
if (process.env.COLOR_SCHEME) features.push({ name: 'prefers-color-scheme', value: process.env.COLOR_SCHEME })
await send('Emulation.setEmulatedMedia', { features })
const desktop = () => send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false })
const phone = () => send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
// The agent panel covers a phone screen, so close it for the picture and open it again after.
const shotPhone = async (name) => {
  await phone()
  await sleep(600)
  await clickAt(`document.querySelector('[aria-label="Close the agent"]')`)
  await shot(name)
  await desktop()
  await sleep(400)
  await clickAt(`[...document.querySelectorAll('header button')].find((b) => b.textContent.trim() === 'Agent')`)
  await until(`document.querySelector("aside[aria-label='Dispatch agent']")`)
}
await desktop()

await go('/sign-in')
if (await js('!!document.querySelector("form input[name=email]")')) {
  await js(`(() => { const f = document.querySelector('form'); f.email.value = ${JSON.stringify(email)}; f.password.value = ${JSON.stringify(password)}; f.requestSubmit(); return true })()`)
  await until('document.querySelector("[data-slot=sidebar-wrapper]")')
}
await js('localStorage.removeItem("nextsci.mock.v1"); localStorage.setItem("nextsci.agentPanel", JSON.stringify({ state: { open: true }, version: 0 }))')

// NS 01: an empty workspace asks for a description.
await go('/today')
await check('an empty workspace opens Today on the description box', async () => (await main()).includes("Let's plan your first day"), main)
await shotPhone('assistant-ns01-390')
await click('main button', 'Try with sample data')
await check('Try with sample data fills the box and attaches the sample orders', async () =>
  (await js('document.querySelector("main textarea").value')).startsWith("We're a food delivery kitchen") && (await main()).includes('orders-21-nov.csv'))
await shot('assistant-ns01')

// NS 02: the agent drafts the setup, and nothing is saved yet.
await click('main button', 'Set it up')
await check('the agent drafts the setup for review', async () => (await main()).includes("Here's your setup") && (await main()).includes('10 motorbikes · 10 boxes each'), main)
await check('the panel shows what the agent understood and assumed', async () =>
  (await panel()).includes('Nothing is saved until you confirm') && (await panel()).includes('I assumed the break can start any time 12:00–13:00'), panel)
await check('nothing is saved before the dispatcher confirms', async () => (await mock('depot', 'm.listDepots()')).length === 0)
await clickAt(`document.querySelector('[aria-label="Edit fleet"]')`)
await until('document.querySelector("#draft-drivers")')
await type('#draft-drivers', '9')
await click('main button', 'Tell the agent')
await check('an edit to the draft goes through the agent and changes the draft', async () => (await main()).includes('9 motorbikes · 10 boxes each'), main)
await shot('assistant-ns02')
await go('/today')
await check('the draft and the conversation come back after a reload', async () =>
  (await main()).includes('9 motorbikes') && (await panel()).includes('9 drivers on motorbikes'), async () => `${await main()} | ${await panel()}`)

// NS 03: confirming saves the setup, reads the attached orders, and fixes what it can.
await click('main button', 'Looks right, continue')
await check('confirming creates the depot, vehicles, and drivers', async () =>
  (await mock('depot', 'm.listDepots()')).length === 1 && (await mock('driver', 'm.listDrivers()')).length === 9 && (await mock('vehicle', 'm.listVehicles()')).length === 9)
await check('the agent reads the orders and reports what needs the dispatcher', async () => {
  const text = await main()
  return text.includes('180 orders for') && text.includes('176 ready') && text.includes('3 fixed') && text.includes('1 needs you')
}, main)
await check('the panel explains the import and asks about the order it cannot place', async () =>
  (await panel()).includes('176 addresses found cleanly. I fixed 3') && (await panel()).includes('One order needs you'), panel)
await shot('assistant-ns03')

// NS 04: skip the order, then the goals and capacity check.
await click('main button', 'Skip it today')
await check('skipping the last unplaced order moves on to the goals', async () => (await main()).includes("What should today's plan aim for?"), main)
await check('the agent checked capacity against the fleet', async () => (await main()).includes("Your boxes don't fit in one trip"), main)
await tell("They come back to reload, that's normal for us")
await check('a reply in the composer reaches the agent', async () => (await panel()).includes("I'll add depot reloads"), panel)
await clickAt(`[...document.querySelectorAll('main label')].find((l) => l.textContent.includes('Similar hours for every driver'))`)
await agentIdle()
await check('picking a goal tells the agent', async () => (await panel()).includes("I'll aim for similar hours for every driver"), panel)
await shot('assistant-ns04')

// NS 05: plan with reasons.
await click('main button', 'Plan 179 orders')
await check('the plan is ready with its numbers', async () => /Plan ready · 9 routes/.test(await main()), main)
await check('the agent explains why the plan looks like this', async () => (await panel()).includes('Why it looks like this'), panel)
const plan = await mock('plan', 'm.getCurrentPlan()')
await check('the plan uses the goal the dispatcher picked', async () => plan?.plan.goal === 'balance' && plan.plan.allowReloads, async () => JSON.stringify(plan?.plan))
await shot('assistant-ns05')
await shotPhone('assistant-ns05-390')

// NS 06: edit by asking, preview, then apply.
const orders = await mock('order', 'm.listOrders()')
const drivers = await mock('driver', 'm.listDrivers()')
const moved = plan.routes[0].trips[0].stops.at(-1).orderId
const customer = orders.find((o) => o.id === moved).customer
const to = drivers.find((d) => d.id === plan.routes[1].driverId).name
await tell(`${customer} should go with ${to}, they know the owner`)
await check('asking for a move previews it on the timeline', async () => (await main()).includes('Previewing a change') && (await main()).includes(`Move ${customer}`), main)
await check('the agent asks whether the move is for today or always', async () => await js(`!!(${byText('aside button', 'Always')})`), panel)
await shot('assistant-ns06')
await click('aside button', 'Always')
await check('Always turns the move into a pin', async () => (await main()).includes(`Keep ${customer} with ${to}`), main)
await check('nothing moves until the change is applied', async () => (await mock('plan', 'm.getCurrentPlan()')).plan.version === 1)
await click('main button', 'Apply change')
await check('applying keeps the stop with the driver', async () => {
  const after = await mock('plan', 'm.getCurrentPlan()')
  return after.plan.version === 2 && after.plan.pins.some((p) => p.orderId === moved)
})

// NS 07: send with approval.
await click('main button', 'Send to drivers')
await check('sending asks for approval first', async () => (await main()).includes('Send 9 routes for') && (await main()).includes('9 drivers have no phone number'), main)
await type('input[aria-label="Phone number for Driver 001"]', '+62 812 0000 0001')
await click('main button', 'Save')
await check('a phone number added on Today is saved to the driver', async () => (await mock('driver', 'm.listDrivers()')).find((d) => d.name === 'Driver 001').phone === '+62 812 0000 0001')
await check('the driver now gets a link', async () => (await main()).includes('8 drivers have no phone number'), main)
await shot('assistant-ns07')
await click('main button', 'Send now')
await check('Send now sends the routes it can', async () => (await main()).includes('1 of 9 routes sent'), main)
await check("today's log records the send", async () => (await panel()).includes("Today's log") && (await panel()).includes('Sent 1 route'), panel)

// NS 08: the live day, with the agent watching.
await click('main button', 'Start the day')
await check('starting the day goes live', async () => /Live · \d\d:\d\d/.test(await main()), main)
const live = await mock('plan', 'm.getCurrentPlan()')
const slowed = live.routes.find((r) => r.trips.some((t) => t.stops.some((s) => orders.find((o) => o.id === s.orderId)?.window)))
const firstWindowed = slowed.trips.flatMap((t) => t.stops).find((s) => orders.find((o) => o.id === s.orderId)?.window)
await mock('liveDay', `m.addIncident({ planId: '${live.plan.id}', driverId: '${slowed.driverId}', at: ${firstWindowed.eta - 20}, delayMinutes: 90, place: 'Jl. Godean' })`)
await mock('liveDay', `m.setDayClock({ kind: 'seek', minute: ${firstWindowed.eta - 10} })`)
// The test wrote to the mock server behind the page's back, so reload to read it, as the tour does.
await go('/today')
await check('the agent notices the late driver and asks for a decision', async () => (await main()).includes('Needs a decision') && (await main()).includes('is 90 min behind'), main)
const lateLog = () => mock('agentMessage', 'm.listAgentMessages()').then((all) => all.filter((m) => m.id.startsWith('agent_message_late_')).length)
const seekMinute = firstWindowed.eta - 10
const started = () => mock('liveDay', `m.listIncidents('${live.plan.id}')`).then((all) => all.filter((i) => i.at <= seekMinute).length)
await check('the late driver is in the log once', async () => (await lateLog()) === (await started()), async () => `${await lateLog()} vs ${await started()}`)
await shot('assistant-ns08')
await shotPhone('assistant-ns08-390')
await clickAt(`[...document.querySelectorAll('main button')].find((b) => b.textContent.trim().startsWith('Reassign'))`)
await agentIdle()
await check('reassigning moves the stops while the day runs', async () => (await panel()).includes('Applied: Give'), panel)

await go('/today')
await check('after a reload the day is still live and the conversation is all there', async () =>
  /Live · /.test(await main()) && (await panel()).includes('Applied: Give') && (await panel()).includes("Here's the change"), async () => `${await main()} | ${await panel()}`)
await check('a reload does not report the incident again', async () => (await lateLog()) === (await started()), async () => `${await lateLog()} vs ${await started()}`)
await shot('assistant-live-reloaded')

await tell('what is the meaning of life')
await check('a question the agent cannot answer gets a next step, not an error', async () => (await panel()).includes("I didn't catch that"), panel)

await js('localStorage.removeItem("nextsci.agentPanel")')
await send('Browser.close').catch(() => {})
console.log(failed ? `${failed} assistant check(s) failed` : 'all assistant checks passed')
process.exit(failed ? 1 : 0)
