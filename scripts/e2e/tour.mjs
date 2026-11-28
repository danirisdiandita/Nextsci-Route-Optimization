// Tours every dashboard screen on the mock data in Chrome over the DevTools protocol, and screenshots each one.
//   node scripts/e2e/tour.mjs <chrome-debug-port> <dashboard-url> <screenshot-dir> <email> <password>
// scripts/e2e-dashboard.sh runs it after the sign-in test. Set COLOR_SCHEME=light or dark for the screenshots,
// and WIDTH to capture at another width (default 1280).
import { writeFileSync } from 'node:fs'

const [port, base, out, email, password] = process.argv.slice(2)
const width = Number(process.env.WIDTH ?? 1280)
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
  // A DOM node does not survive returnByValue, so test the expression as a boolean inside the page.
  for (const end = Date.now() + ms; Date.now() < end; await sleep(100)) if (await js(`!!(${expr})`)) return true
  return false
}
const url = () => js('location.pathname')
const heading = () => js('document.querySelector("header h1")?.textContent ?? ""')
const main = () => js('document.querySelector("main")?.innerText.replace(/\\s+/g, " ").trim() ?? ""')
const go = async (path) => { await send('Page.navigate', { url: new URL(path, base).href }); await sleep(300); await until('document.querySelector("form, [data-slot=sidebar-wrapper]")') }
const shot = async (name) => { await sleep(400); const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(`${out}/${name}.png`, Buffer.from(r.result.data, 'base64')) }
// Clicks with real mouse events, which menus and dialogs need.
const clickAt = async (expr) => {
  const at = await js(`(() => { const r = (${expr})?.getBoundingClientRect(); return r && { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
  if (!at) return false
  for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, ...at, button: 'left', clickCount: 1 })
  return true
}
const clickText = (selector, label) => js(`(() => { const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find((e) => e.textContent.trim() === ${JSON.stringify(label)}); el?.click(); return !!el })()`)
// Runs a function of the mock server inside the page, the same module the dashboard uses.
const mock = (module, call) => js(`import('/src/api/mock/${module}.ts').then((m) => ${call}).then((r) => JSON.parse(JSON.stringify(r ?? null)))`)

let failed = 0
// Polls until the screen shows what the check expects, since mock calls answer after a delay.
const check = async (name, holds, detail = async () => '') => {
  let ok = false
  for (const end = Date.now() + 5000; !(ok = Boolean(await holds())) && Date.now() < end; ) await sleep(100)
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `  (${await detail()})`}`)
  if (!ok) failed++
}

const features = [{ name: 'prefers-reduced-motion', value: 'reduce' }]
if (process.env.COLOR_SCHEME) features.push({ name: 'prefers-color-scheme', value: process.env.COLOR_SCHEME })
await send('Emulation.setEmulatedMedia', { features })
await send('Emulation.setDeviceMetricsOverride', { width, height: 800, deviceScaleFactor: 1, mobile: false })

await go('/sign-in')
if (await js('!!document.querySelector("form input[name=email]")')) {
  await js(`(() => { const f = document.querySelector('form'); f.email.value = ${JSON.stringify(email)}; f.password.value = ${JSON.stringify(password)}; f.requestSubmit(); return true })()`)
  await until('document.querySelector("[data-slot=sidebar-wrapper]")')
}
await js('localStorage.removeItem("nextsci.mock.v1"); localStorage.removeItem("nextsci.agentPanel")')

await go('/')
await check('an empty workspace opens on the setup checklist', async () => (await url()) === '/onboarding' && (await heading()) === 'Get started', async () => `${await url()} ${await heading()}`)
await check('the checklist shows no step done', async () => (await main()).includes('0 of 4 done'), async () => await main())
await shot('onboarding-empty')
await go('/routes')
await check('Routes without a plan offers to plan', async () => (await main()).includes('No routes yet'), async () => await main())
await shot('routes-empty')

await clickAt('document.querySelector("[data-slot=sidebar-footer] [data-sidebar=menu-button]")')
await until('[...document.querySelectorAll("[role=menuitem]")].some((e) => e.textContent.includes("Reset demo data"))')
await clickText('[role=menuitem]', 'Reset demo data')
await until('document.querySelector("[role=alertdialog]")')
await shot('reset-confirm')
await clickText('[role=alertdialog] button', 'Reset demo data')
await until('location.pathname === "/today"')
await check('Reset demo data loads the sample and opens Today', async () => (await url()) === '/today' && /180 orders, 10 drivers/.test(await main()), async () => `${await url()} ${await main()}`)

const screens = [
  ['/today', 'today'],
  ['/onboarding', 'onboarding'],
  ['/routes', 'routes'],
  ['/routes/new', 'routes-new'],
  ['/routes/timeline', 'routes-timeline'],
  ['/routes/live', 'routes-live'],
  ['/stops', 'stops'],
  ['/stops/new', 'stops-new'],
  ['/stops/import', 'stops-import'],
  ['/stops/review', 'stops-review'],
  ['/stops/order_s001', 'stop'],
  ['/drivers', 'drivers'],
  ['/drivers/new', 'drivers-new'],
  ['/drivers/vehicles', 'vehicles'],
  ['/drivers/driver_s03', 'driver'],
  ['/depots', 'depots'],
  ['/depots/new', 'depots-new'],
  ['/depots/depot_layur', 'depot'],
]
for (const [path, name] of screens) {
  await go(path)
  await check(`${path} renders in the shell`, async () => (await url()) === path && (await heading()) !== 'Page not found', async () => `${await url()} ${await heading()}`)
  await shot(`route-${name}`)
}
const fileImport = await mock('workspace', 'm.getSampleOrdersFile()').then((f) => mock('orderImport', `m.createOrderImport(${JSON.stringify(f.fileName)}, ${JSON.stringify(f.text)})`))
await go(`/stops/import/${fileImport.id}`)
await check('an import opens on its column matching screen', async () => (await main()).includes('180 rows'), async () => await main())
await shot('route-stops-import-mapping')

await go('/depots/depot_layur')
await check('a depot opens by its id', async () => (await heading()) === 'Depot' && (await main()).includes('Dapur Layur'), async () => await main())
await mock('depot', `m.updateDepot('depot_layur', { name: 'Dapur Layur Utama' })`)
await go('/depots')
await check('a mock edit survives a reload', async () => (await main()).includes('Dapur Layur Utama'), async () => await main())
const vehiclesBefore = (await mock('vehicle', 'm.listVehicles()')).length
await mock('vehicle', `m.deleteVehicle('vehicle_s03')`)
await go('/drivers')
await check('deleting a vehicle leaves its driver without one', async () => (await mock('driver', 'm.getDriver("driver_s03")')).vehicleId === null && (await mock('vehicle', 'm.listVehicles()')).length === vehiclesBefore - 1)
await go('/depots/depot_nope')
await check('an unknown id shows a readable error', async () => (await main()).includes('This depot no longer exists.'), async () => await main())

await go('/today')
await clickText('header button', 'Agent')
await until('document.querySelector("aside[aria-label=\'Dispatch agent\']")')
await check('the Agent button opens the dispatch agent beside the page', async () => await js('!!document.querySelector("aside[aria-label=\'Dispatch agent\'] textarea")'))
await js(`(() => { const t = document.querySelector('aside textarea'); const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; set.call(t, 'Kedai Kanjeng Mami should go with Driver 003'); t.dispatchEvent(new Event('input', { bubbles: true })); return true })()`)
await clickText('aside button', 'Send')
await until('document.querySelector("aside ol li")')
await go('/today')
await check('the panel stays open and the message stays after a reload', async () => await js('document.querySelector("aside ol")?.textContent.includes("Kanjeng Mami")'), async () => await js('document.querySelector("aside")?.innerText'))
await shot('today-agent-open')
await go('/drivers/new')
await check('the setup hint hides once setup is done', async () => !(await js('document.querySelector("header").innerText.includes("Setup step")')))
await mock('workspace', 'm.clearAll()')
await go('/depots/new')
await check('a setup screen shows its step while setup is not done', async () => await js('document.querySelector("header").innerText.includes("Setup step 1 of 4")'), async () => await js('document.querySelector("header").innerText'))
await check('a child screen shows its section as a breadcrumb', async () => await js('document.querySelector("header").innerText.includes("Depots")') && (await heading()) === 'New depot', async () => await heading())
await shot('depots-new-setup')
await go('/routes/no-such-route')
await check('an unknown path still shows not found', async () => (await heading()) === 'Page not found', async () => await heading())
await js('localStorage.removeItem("nextsci.agentPanel")')

await send('Browser.close').catch(() => {})
console.log(failed ? `${failed} tour check(s) failed` : 'all tour checks passed')
process.exit(failed ? 1 : 0)
