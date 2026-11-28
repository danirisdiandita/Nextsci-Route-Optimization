// Walks the routes screens on the mock data in Chrome over the DevTools protocol: plan settings, the planned
// routes, editing on the timeline, sending, and the live day. Each edit is checked again after a reload.
//   node scripts/e2e/routes.mjs <chrome-debug-port> <dashboard-url> <screenshot-dir> <email> <password>
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
const until = async (expr, ms = 10000) => {
  for (const end = Date.now() + ms; Date.now() < end; await sleep(100)) if (await js(`!!(${expr})`)) return true
  return false
}
const url = () => js('location.pathname')
const main = () => js('document.querySelector("main")?.innerText.replace(/\\s+/g, " ").trim() ?? ""')
const header = () => js('document.querySelector("header")?.innerText.replace(/\\s+/g, " ").trim() ?? ""')
const go = async (path) => { await send('Page.navigate', { url: new URL(path, base).href }); await sleep(300); await until('document.querySelector("form, [data-slot=sidebar-wrapper]")') }
const reload = async () => { await send('Page.reload'); await sleep(300); await until('document.querySelector("[data-slot=sidebar-wrapper]")') }
const shot = async (name) => { await sleep(400); const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(`${out}/${name}.png`, Buffer.from(r.result.data, 'base64')) }
const center = (expr) => js(`(() => { const el = (${expr}); if (!el) return null; el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
const mouse = (type, at) => send('Input.dispatchMouseEvent', { type, ...at, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 })
const clickAt = async (expr) => {
  const at = await center(expr)
  if (!at) return false
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...at })
  await mouse('mousePressed', at)
  await mouse('mouseReleased', at)
  return true
}
const byText = (selector, text) => `[...document.querySelectorAll(${JSON.stringify(selector)})].find((e) => e.textContent.trim() === ${JSON.stringify(text)} || e.getAttribute('aria-label') === ${JSON.stringify(text)})`
const clickText = async (selector, text) => (await until(byText(selector, text))) && clickAt(byText(selector, text))
const press = async (key) => {
  for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key, code: key, windowsVirtualKeyCode: { ArrowDown: 40, ArrowUp: 38, ArrowLeft: 37, ArrowRight: 39 }[key] })
}
const mock = (module, call) => js(`import('/src/api/mock/${module}.ts').then((m) => ${call}).then((r) => JSON.parse(JSON.stringify(r ?? null)))`)
const plan = () => mock('plan', 'm.getCurrentPlan()')
const stopsOf = (view, driverId) => view.routes.find((r) => r.driverId === driverId)?.trips.flatMap((t) => t.stops.map((s) => s.orderId)) ?? []

let failed = 0
const check = async (name, holds, detail = async () => '') => {
  let ok = false
  for (const end = Date.now() + 6000; !(ok = Boolean(await holds())) && Date.now() < end; ) await sleep(100)
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `  (${await detail()})`}`)
  if (!ok) failed++
}

const features = [{ name: 'prefers-reduced-motion', value: 'reduce' }]
if (process.env.COLOR_SCHEME) features.push({ name: 'prefers-color-scheme', value: process.env.COLOR_SCHEME })
await send('Emulation.setEmulatedMedia', { features })
const size = (width) => send('Emulation.setDeviceMetricsOverride', { width, height: 800, deviceScaleFactor: 1, mobile: false })
await size(1280)

await go('/sign-in')
if (await js('!!document.querySelector("form input[name=email]")')) {
  await js(`(() => { const f = document.querySelector('form'); f.email.value = ${JSON.stringify(email)}; f.password.value = ${JSON.stringify(password)}; f.requestSubmit(); return true })()`)
  await until('document.querySelector("[data-slot=sidebar-wrapper]")')
}
await js('localStorage.removeItem("nextsci.mock.v1"); localStorage.removeItem("nextsci.agentPanel")')
await mock('workspace', 'm.resetDemo()')
const sample = await plan()
await mock('plan', `m.deletePlan(${JSON.stringify(sample.plan.id)})`)

// NM 06: plan settings.
await go('/routes/new')
await check('plan settings sum up the sample', async () => /Stops 180/.test(await main()) && /Drivers 9 of 10/.test(await main()), main)
await check('Eko is off today and left out', async () => await js(`${byText('button[aria-pressed]', 'Eko · off today')}?.getAttribute('aria-pressed') === 'false'`))
await clickText('label', 'Balance work between driversEveryone finishes around the same time.')
await check('a goal is picked by clicking it', async () => await js('document.querySelector("[data-slot=radio-group-item][data-checked]")?.closest("label")?.textContent.includes("Balance")'))
await shot('routes-plan-settings')
await clickText('button', 'Plan routes')
await until('location.pathname === "/routes"')
await check('Plan routes solves the day and opens the routes', async () => (await url()) === '/routes' && (await header()).includes('Draft') && /Routes 9/.test(await main()), async () => `${await url()} ${await header()}`)
await check('the chosen goal is saved with the plan', async () => (await plan())?.plan.goal === 'balance')

// NM 07: planned routes.
await check('each route lists its stops, trips, and return', async () => (await js('document.querySelectorAll("table[aria-label=Routes] tbody tr").length')) === 9)
await check('with no route picked, the map shows each driver\'s stops and no lines', async () => (await js('document.querySelectorAll("svg g[fill=none]").length')) === 0 && (await js('document.querySelectorAll("svg circle").length')) >= 170)
await shot('routes-planned')
await clickAt('document.querySelector("table[aria-label=Routes] tbody tr button")')
await check('picking a route draws only its lines, at full strength', async () => (await js('[...document.querySelectorAll("svg g[fill=none]")].map((g) => g.style.opacity).join()')) === '1')
await shot('routes-planned-selected')

// NM 08: edit on the timeline.
await go('/routes/timeline')
await until('document.querySelector("[data-lane] [data-order]")')
const before = await plan()
const [first, second] = before.routes
// The row that finishes earliest has room for one more stop, so the move keeps it rather than leave it unassigned.
const roomy = before.routes.filter((r) => r !== second).reduce((a, b) => (b.end < a.end ? b : a))
const draggedId = await js(`document.querySelector('[data-lane="${second.driverId}"] [data-order]').dataset.order`)
const from = await center(`document.querySelector('[data-order="${draggedId}"]')`)
const to = await center(`document.querySelector('[data-lane="${roomy.driverId}"]')`)
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...from })
await mouse('mousePressed', from)
for (let i = 1; i <= 8; i++) await mouse('mouseMoved', { x: from.x + ((to.x - from.x) * i) / 8, y: from.y + ((to.y - from.y) * i) / 8 })
await mouse('mouseReleased', to)
await check('dragging a stop to another row previews the move', async () => /Moved .+ from .+ to .+/.test(await main()) && (await header()).includes('1 unsaved'), async () => `${await header()} | ${await main()}`)
await check('the change bar shows the impact and the stop still fits', async () => /km total/.test(await main()) && !/no longer fit/.test(await main()), main)
await check('the moved stop sits in its new row as an outline', async () => await js(`!!document.querySelector('[data-lane="${roomy.driverId}"] [data-order="${draggedId}"]')`))
await shot('routes-timeline-change')
await clickText('button', 'Save change')
await check('saving applies the move', async () => stopsOf(await plan(), roomy.driverId).includes(draggedId))
await reload()
await check('a saved move survives a reload and can be undone', async () => /Last change: Moved/.test(await main()) && (await js(`!!document.querySelector('[data-lane="${roomy.driverId}"] [data-order="${draggedId}"]')`)), main)
await clickText('button', 'Undo')
await check('undo puts the stop back', async () => stopsOf(await plan(), second.driverId).includes(draggedId))

await until(`document.querySelector('[data-lane="${first.driverId}"] [data-order]')`)
const keyed = await js(`document.querySelector('[data-lane="${first.driverId}"] [data-order]').dataset.order`)
await js(`document.querySelector('[data-order="${keyed}"]').focus()`)
await press('ArrowDown')
await check('the arrow keys move a focused stop to the next row', async () => await js(`!!document.querySelector('[data-lane="${second.driverId}"] [data-order="${keyed}"]')`))
await check('focus follows the moved stop', async () => (await js('document.activeElement?.dataset.order')) === keyed)
await clickText('button', 'Undo')
await check('undo in the change bar drops the unsaved move', async () => !(await header()).includes('unsaved') && (await js(`!!document.querySelector('[data-lane="${first.driverId}"] [data-order="${keyed}"]')`)))
const clicked = await js(`document.querySelectorAll('[data-lane="${first.driverId}"] [data-order]')[1].dataset.order`)
await clickAt(`document.querySelector('[data-order="${clicked}"]')`)
await check('clicking a stop shows its details', async () => await js('!!document.querySelector("section[aria-label^=\'Stop \']")'))
await clickText('button', 'Later')
await check('Later moves it one place on its route', async () => /Moved .+ later on/.test(await main()), main)
await shot('routes-timeline-details')
await clickText('button', 'Undo')

// NM 09: send to drivers.
await go('/routes')
await clickText('button', 'Send to drivers')
await until('document.querySelector("[role=dialog]")')
await check('the send dialog lists each driver with how the route reaches them', async () => {
  const text = await js('document.querySelector("[role=dialog]").innerText')
  return /Send routes to 9 drivers/.test(text) && /Nextsci app/.test(text) && /Link by SMS/.test(text) && /No phone number/.test(text)
}, () => js('document.querySelector("[role=dialog]")?.innerText'))
await clickText('[role=dialog] button', 'WhatsApp')
await check('links can go by WhatsApp instead', async () => /Link by WhatsApp/.test(await js('document.querySelector("[role=dialog]").innerText')))
await shot('routes-send')
await clickText('[role=dialog] button', 'Send 8 routes')
await check('sending marks the plan sent', async () => (await plan()).plan.status === 'sent' && (await header()).includes('Sent'), header)
await reload()
await check('the sent plan shows how each route went after a reload', async () => (await header()).includes('Sent') && /WhatsApp/.test(await main()) && /Not sent/.test(await main()), main)

// NM 10: live day.
await clickText('button', 'Start the day')
await until('location.pathname === "/routes/live"')
await check('starting the day opens the live view', async () => (await url()) === '/routes/live' && /Live · \d\d:\d\d/.test(await header()), header)
await clickText('button', 'Pause the clock')
await check('the clock pauses', async () => (await mock('liveDay', 'm.getDayClock()')).kind === 'paused')
const [incident] = await mock('liveDay', `m.listIncidents(${JSON.stringify(before.plan.id)})`)
await mock('liveDay', `m.setDayClock({ kind: 'seek', minute: ${incident.at + 30} })`)
await reload()
await check('a driver held up shows the late alert', async () => /is 25 min behind/.test(await main()), main)
await shot('routes-live-alert')
const live = await plan()
const lateId = incident.driverId
const pendingBefore = stopsOf(live, lateId)
await clickText('[role=alert] button', 'Move stops')
await check('Move stops previews the handover', async () => /If you move \d+ stops? to/.test(await main()) && /back \d\d:\d\d/.test(await main()), main)
await shot('routes-live-move')
await until(`[...document.querySelectorAll('button')].some((b) => /^Move \\d+ stops?$/.test(b.textContent.trim()) && !b.disabled)`)
const moveLabel = await js(`[...document.querySelectorAll('button')].find((b) => /^Move \\d+ stops?$/.test(b.textContent.trim())).textContent.trim()`)
await clickText('button', moveLabel)
await check('the stops move to another driver and the day keeps running', async () => {
  const after = await plan()
  return after.plan.status === 'live' && stopsOf(after, lateId).length < pendingBefore.length && after.unassigned.length === live.unassigned.length
})
await reload()
await check('the handover is saved as a change', async () => (await mock('plan', `m.listPlanChanges(${JSON.stringify(live.plan.id)})`)).some((c) => c.status === 'applied' && /^Moved \d+ stops? from/.test(c.summary)))

const firstDriver = live.routes[0].driverId
await until(`document.querySelector('ul[aria-label=Drivers] li button')`)
await clickAt(`document.querySelector('ul[aria-label=Drivers] li button')`)
await until('document.querySelector("#driver-stops-title")')
await clickText('button', 'Not delivered')
await clickText('[role=menuitem]', 'Customer not home')
await check('a stop can be marked not delivered', async () => (await plan()).routes.find((r) => r.driverId === firstDriver).trips.flatMap((t) => t.stops).some((s) => s.failure?.reason === 'Customer not home'))
await reload()
await until(`document.querySelector('ul[aria-label=Drivers] li button')`)
await clickAt(`document.querySelector('ul[aria-label=Drivers] li button')`)
await check('the failed stop shows its reason after a reload', async () => /Customer not home/.test(await main()), main)
await shot('routes-live-driver')
await clickText('button', 'Close')

for (const [path, name] of [['/routes/new', 'routes-plan-settings'], ['/routes', 'routes-planned'], ['/routes/timeline', 'routes-timeline'], ['/routes/live', 'routes-live']]) {
  await size(390)
  await go(path)
  await sleep(500)
  // The shell's content column scrolls by itself, so check it as well as the page.
  const widths = 'JSON.stringify([document.documentElement.scrollWidth, document.querySelector("main .overflow-y-auto").scrollWidth])'
  await check(`${path} fits a 390px screen`, async () => JSON.parse(await js(widths)).every((w) => w <= 390), () => js(widths))
  await shot(`${name}-390`)
  await size(1280)
}

await send('Browser.close').catch(() => {})
console.log(failed ? `${failed} routes check(s) failed` : 'all routes checks passed')
process.exit(failed ? 1 : 0)
