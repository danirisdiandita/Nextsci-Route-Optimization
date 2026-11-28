// Walks manual setup in Chrome with real clicks and typing: the checklist, the depot, drivers and vehicles,
// the delete rules, and the sample data entry points. Checks that each write survives a reload.
//   node scripts/e2e/setup.mjs <chrome-debug-port> <dashboard-url> <screenshot-dir> <email> <password>
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
const go = async (path) => { await send('Page.navigate', { url: new URL(path, base).href }); await sleep(300); await until('document.querySelector("[data-slot=sidebar-wrapper]")') }
const reload = async () => { await send('Page.reload'); await sleep(300); await until('document.querySelector("[data-slot=sidebar-wrapper]")') }
const shot = async (name, width = 1280) => {
  await send('Emulation.setDeviceMetricsOverride', { width, height: 800, deviceScaleFactor: 1, mobile: width < 600 })
  await sleep(500)
  const r = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(`${out}/setup-${name}${width === 1280 ? '' : `-${width}`}.png`, Buffer.from(r.result.data, 'base64'))
  const sideways = await js('document.documentElement.scrollWidth > innerWidth || [...document.querySelectorAll("main, main > div, main > div > div")].some((el) => el.scrollWidth > el.clientWidth + 1)')
  if (sideways) console.log(`warn ${name} at ${width}px scrolls sideways`)
  if (width !== 1280) {
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false })
    await sleep(500)
  }
}
const q = (selector) => `document.querySelector(${JSON.stringify(selector)})`
const byText = (selector, text) => `[...document.querySelectorAll(${JSON.stringify(selector)})].find((e) => e.textContent.trim() === ${JSON.stringify(text)})`
// Real mouse events at the element's center, which menus, selects, and dialogs need.
const clickAt = async (expr) => {
  await until(expr, 5000)
  await js(`(${expr})?.scrollIntoView({ block: 'center' })`)
  const at = await js(`(() => { const r = (${expr})?.getBoundingClientRect(); return r && { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
  if (!at) throw new Error(`nothing to click: ${expr}`)
  for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, ...at, button: 'left', clickCount: 1 })
  await sleep(150)
}
const press = async (key) => {
  const codes = { Enter: 13, ArrowDown: 40, Escape: 27, Backspace: 8 }
  for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key, code: key, windowsVirtualKeyCode: codes[key] })
}
// Focuses a field, selects what it holds, and types over it, as a person would.
const type = async (expr, text) => {
  await clickAt(expr)
  await js(`(${expr}).select?.()`)
  if (!text) await press('Backspace')
  else await send('Input.insertText', { text })
  await sleep(100)
}
// A time field's text depends on the browser's locale, so set it the way React reads a change.
const setTime = (expr, value) =>
  js(`(() => { const el = ${expr}; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('input', { bubbles: true })); return true })()`)
// Opens a select by its trigger and picks the option with this label.
const choose = async (triggerExpr, label) => {
  await clickAt(triggerExpr)
  await until(byText('[role=option]', label))
  await clickAt(byText('[role=option]', label))
  await sleep(200)
}
const mock = (module, call) => js(`import('/src/api/mock/${module}.ts').then((m) => ${call}).then((r) => JSON.parse(JSON.stringify(r ?? null)))`)

let failed = 0
const check = async (name, holds, detail = async () => await main()) => {
  let ok = false
  for (const end = Date.now() + 5000; !(ok = Boolean(await holds())) && Date.now() < end; ) await sleep(100)
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `  (${String(await detail()).slice(0, 400)})`}`)
  if (!ok) failed++
}
const has = async (text) => (await main()).includes(text)

const features = [{ name: 'prefers-reduced-motion', value: 'reduce' }]
if (process.env.COLOR_SCHEME) features.push({ name: 'prefers-color-scheme', value: process.env.COLOR_SCHEME })
await send('Emulation.setEmulatedMedia', { features })
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false })

await send('Page.navigate', { url: new URL('/sign-in', base).href })
await until('document.querySelector("form input[name=email], [data-slot=sidebar-wrapper]")')
if (await js('!!document.querySelector("form input[name=email]")')) {
  await js(`(() => { const f = document.querySelector('form'); f.email.value = ${JSON.stringify(email)}; f.password.value = ${JSON.stringify(password)}; f.requestSubmit(); return true })()`)
  await until('document.querySelector("[data-slot=sidebar-wrapper]")')
}
await js('localStorage.removeItem("nextsci.mock.v1"); localStorage.removeItem("nextsci.agentPanel")')

// The checklist on an empty workspace.
await go('/onboarding')
await check('an empty workspace shows four steps, none done', async () => (await has('0 of 4 done')) && (await has('Add your depot')) && (await has('Plan routes')))
await check('the first step is the current one', async () => await js(`${q('li[aria-current=step]')}?.textContent.includes('Add your depot')`))
await shot('checklist-empty')
await shot('checklist-empty', 390)
await clickAt(byText('main a', 'Add depot'))
await check('Add depot opens setup step 1', async () => (await url()) === '/depots/new' && (await js('document.querySelector("header").innerText.includes("Setup step 1 of 4")')))

// NM 02: the depot form.
await clickAt(byText('form button', 'Save depot'))
await check('saving an empty depot names each field to fix', async () => (await has('Give the depot a name')) && (await has('Type the address and pick it from the list')))
await type(q('#depot-name'), 'Dapur Layur')
await type(q('#depot-address'), 'Jl. Layur')
await check('typing an address suggests matches', async () => await js(`${q('[role=listbox]')}?.querySelectorAll('[role=option]').length > 0`))
await shot('depot-search')
await press('ArrowDown')
await press('Enter')
await check('picking a suggestion pins the address', async () => (await has('Pinned at Jl. Layur')) && (await js(`${q('svg[role=img]')}?.getAttribute('aria-label').startsWith('Map with the depot at')`)))
await setTime(q('#depot-close'), '17:00')
await type(q('#depot-load'), '')
await clickAt(byText('form button', 'Save depot'))
await check('a missing loading time is caught before saving', async () => await has('Enter whole minutes, 0 or more.'))
await type(q('#depot-load'), '12')
await shot('depot-filled')
await clickAt(byText('form button', 'Save depot'))
await check('saving the depot moves on to setup step 2', async () => (await url()) === '/drivers' && (await js('document.querySelector("header").innerText.includes("Setup step 2 of 4")')))
const [depot] = await mock('depot', 'm.listDepots()')
await check('the depot saved what was typed', async () => depot?.name === 'Dapur Layur' && depot.loadMinutes === 12 && depot.hours.end === 17 * 60 && depot.address.startsWith('Jl. Layur'), async () => JSON.stringify(depot))

// NM 03: drivers, several at once.
await check('drivers start empty with the starting defaults', async () => (await has('No drivers yet')) && (await js(`${q('#default-shift')}.value`)) === '08:00–16:00')
await shot('drivers-empty')
await clickAt(byText('main button', 'Add several drivers'))
await until(q('#driver-lines'))
await type(q('#driver-lines'), 'Name, Phone\nBudi Santoso, +62 812 0000 0101\nSari Wulandari, +62 812 0000 0102\nAgus Pratama, +62 812 0000 0103\nDewi Lestari')
await check('the dialog counts the pasted drivers and skips the header', async () => await js(`document.querySelector('[role=dialog]').innerText.includes('4 drivers to add')`))
await shot('drivers-paste')
await clickAt(byText('[role=dialog] button', 'Add 4 drivers'))
await check('four drivers appear in the table', async () => (await js('document.querySelectorAll("main tbody tr").length')) === 4 && (await has('Dewi Lestari')))
await check('a driver pasted without a phone shows none', async () => await has('No phone'))
await check('each new driver gets a vehicle at the depot', async () => (await mock('vehicle', 'm.listVehicles()')).filter((v) => v.depotId === depot.id).length === 4)

// Inline edit: Agus drives the 40-box car from ten.
await clickAt(q('button[aria-label="Edit Agus Pratama"]'))
await until(q('input[aria-label=Shift]'))
await type(q('input[aria-label=Shift]'), '10:00–18:00')
await choose(q('main tbody [aria-label=Vehicle]'), 'Car')
await type(q('input[aria-label=Capacity]'), '40')
await clickAt(q('button[aria-label=Save]'))
const agusRow = `[...document.querySelectorAll('main tbody tr')].find((tr) => tr.textContent.includes('Agus Pratama'))`
await check('Agus shows 10:00–18:00, Car, 40 boxes', async () => await js(`${agusRow}?.textContent.includes('10:00–18:00') && ${agusRow}.textContent.includes('Car') && ${agusRow}.textContent.includes('40 boxes')`), async () => await js(`${agusRow}?.textContent`))
await check('his row is marked as differing from the defaults', async () => await js(`${agusRow}?.hasAttribute('data-differs')`))
await check('only the cells that differ are bold', async () => await js(`[...${agusRow}.querySelectorAll('td')].filter((td) => td.className.includes('font-[650]')).map((td) => td.textContent).join('|')`) === '10:00–18:00|Car|40 boxes', async () => await js(`[...${agusRow}.querySelectorAll('td')].filter((td) => td.className.includes('font-[650]')).map((td) => td.textContent).join('|')`))
await shot('drivers-agus')
await reload()
await check('the inline edit survives a reload', async () => await js(`${agusRow}?.textContent.includes('40 boxes')`))

// The defaults bar.
await type(q('#default-shift'), '8-16')
await clickAt(byText('main button', 'Apply to all 4'))
await check('a shift that does not parse is named before applying', async () => await has('Write the shift as 08:00–16:00.'))
await type(q('#default-shift'), '07:00–15:00')
await check('a new default marks every driver who would change', async () => (await js('document.querySelectorAll("main tbody tr[data-differs]").length')) === 4)
await clickAt(byText('main button', 'Apply to all 4'))
await until(q('[role=alertdialog]'))
await check('applying asks first and names who changes', async () => await js(`document.querySelector('[role=alertdialog]').innerText.includes('Agus Pratama')`))
await shot('drivers-apply-confirm')
await clickAt(byText('[role=alertdialog] button', 'Apply to all 4'))
await check('after applying, no driver differs', async () => (await js('document.querySelectorAll("main tbody tr[data-differs]").length')) === 0 && (await has('07:00–15:00')))
await reload()
await check('applied defaults survive a reload and become the derived defaults', async () => (await js(`${q('#default-shift')}.value`)) === '07:00–15:00' && !(await has('40 boxes')))

// The driver page: off, home start, no phone.
await clickAt(byText('main tbody a', 'Dewi Lestari'))
await check('a driver opens by name', async () => (await url()).startsWith('/drivers/driver_') && (await js(`${q('#driver-name')}?.value`)) === 'Dewi Lestari')
await clickAt(byText('label', 'Home'))
await type(q('#driver-home'), 'Taman Siswa 20')
await until(`${q('[role=listbox]')}?.querySelector('[role=option]')`)
await clickAt(q('[role=listbox] [role=option]'))
await clickAt(`${byText('span', 'Working')}?.closest('label')?.querySelector('[role=switch]')`)
await type(q('#driver-phone'), '+62 812 0000 0104')
await shot('driver-edit')
await clickAt(byText('form button', 'Save changes'))
await until('document.body.innerText.includes("Dewi Lestari saved")')
await go('/drivers')
const dewiRow = `[...document.querySelectorAll('main tbody tr')].find((tr) => tr.textContent.includes('Dewi Lestari'))`
await check('Dewi starts from home and is off', async () => await js(`${dewiRow}?.textContent.includes('Home → Depot') && ${dewiRow}.textContent.includes('Off')`), async () => await js(`${dewiRow}?.textContent`))

// One driver from the full form.
await clickAt(byText('main a', 'Add driver'))
await until(q('#driver-name'))
await clickAt(byText('form button', 'Save driver'))
await check('a driver without a name is caught', async () => await has('Name is required.'))
await type(q('#driver-name'), 'Rudi Hartono')
await choose(q('form [aria-label=Kind]'), 'Van')
await type(q('form input[aria-label=Capacity]'), '60')
await clickAt(byText('form button', 'Save driver'))
await check('the new driver joins the table with a 60-box van', async () => (await url()) === '/drivers' && (await js(`[...document.querySelectorAll('main tbody tr')].find((tr) => tr.textContent.includes('Rudi Hartono'))?.textContent.includes('60 boxes')`)))
await shot('drivers-list')
await shot('drivers-list', 390)

// Vehicles: add, edit, delete.
await go('/drivers/vehicles')
await clickAt(byText('header button', 'Add vehicle'))
await type(q('input[aria-label="Vehicle name"]'), 'Spare van AB 9001 KD')
await choose(q('main tbody [aria-label=Kind]'), 'Van')
await type(q('main tbody input[aria-label=Capacity]'), '80')
await press('Enter')
await check('a new vehicle is listed with nobody driving it', async () => await js(`[...document.querySelectorAll('main tbody tr')].find((tr) => tr.textContent.includes('Spare van'))?.textContent.includes('Nobody')`))
await clickAt(q('button[aria-label="Edit Spare van AB 9001 KD"]'))
await type(q('main tbody input[aria-label=Capacity]'), '0')
await press('Enter')
await check('a capacity of 0 is refused', async () => await has('Capacity is a whole number of boxes, 1 or more.'))
await type(q('main tbody input[aria-label=Capacity]'), '75')
await press('Enter')
await until(`[...document.querySelectorAll('main tbody tr')].find((tr) => tr.textContent.includes('Spare van'))?.textContent.includes('75 boxes')`)
await reload()
await check('the vehicle edit survives a reload', async () => await js(`[...document.querySelectorAll('main tbody tr')].find((tr) => tr.textContent.includes('Spare van'))?.textContent.includes('75 boxes')`))
await shot('vehicles')
await clickAt(q('button[aria-label="Delete Spare van AB 9001 KD"]'))
await until(q('[role=alertdialog]'))
await clickAt(byText('[role=alertdialog] button', 'Delete vehicle'))
await check('the deleted vehicle is gone', async () => !(await has('Spare van')))

// The checklist reflects what was set up.
await go('/onboarding')
await check('the checklist shows two steps done, with what each holds', async () => (await has('2 of 4 done')) && (await has('5 drivers, 5 vehicles')) && (await has('Jl. Layur')))
await check('Import stops is now the current step', async () => await js(`${q('li[aria-current=step]')}?.textContent.includes('Import stops')`))
await shot('checklist-two-done')

// Delete rules: a depot with vehicles, and a driver on a sent route.
await go(`/depots/${depot.id}`)
await clickAt(byText('form button', 'Delete'))
await until(q('[role=alertdialog]'))
await check('the delete dialog warns about the vehicles first', async () => await js(`document.querySelector('[role=alertdialog]').innerText.includes('5 vehicles still start here')`))
await clickAt(byText('[role=alertdialog] button', 'Delete depot'))
await check('deleting a depot with vehicles shows why it stopped', async () => await has('Dapur Layur still has 5 vehicles. Move or delete them first.'))
await shot('depot-delete-blocked')
await mock('workspace', 'm.resetDemo()')
const plan = await mock('plan', 'm.getCurrentPlan()')
await mock('plan', `m.sendPlan(${JSON.stringify(plan.plan.id)}, { linkChannel: 'sms', notifyCustomers: false, notifyOnChange: true })`)
await go('/drivers/driver_s01')
await clickAt(byText('form button', 'Delete'))
await until(q('[role=alertdialog]'))
await clickAt(byText('[role=alertdialog] button', 'Delete driver'))
await check('deleting a driver on a sent route shows why it stopped', async () => await has('Budi Santoso has a route that was already sent.'))
await go('/drivers/driver_s07')
await clickAt(byText('form button', 'Delete'))
await until(q('[role=alertdialog]'))
await clickAt(byText('[role=alertdialog] button', 'Delete driver'))
await check('a driver with no sent route is deleted', async () => (await url()) === '/drivers' && !(await has('Eko Prasetyo')))

// Sample data entry points.
await go('/onboarding')
await check('a set-up workspace says so and offers Today', async () => (await has('Your workspace is set up')) && (await has('4 of 4 done')) && (await has('Open today')))
await shot('checklist-done')
await clickAt(byText('main button', 'Start empty'))
await until(q('[role=alertdialog]'))
await clickAt(byText('[role=alertdialog] button', 'Delete everything'))
await check('Start empty brings back the empty checklist', async () => (await has('0 of 4 done')) && !(await has('Start empty')))
await clickAt(byText('main button', 'Try with sample data'))
await check('Try with sample data loads the sample and opens Today', async () => (await url()) === '/today' && (await mock('workspace', 'm.getWorkspace()')).counts.drivers === 10)
await go('/drivers')
await check('the sample shows Agus with the 40-box car, set apart', async () => await js(`${agusRow}?.hasAttribute('data-differs') && ${agusRow}.textContent.includes('40 boxes')`))
await shot('drivers-sample')
await go('/depots')
await shot('depots')
await go('/depots/depot_layur')
await shot('depot-edit')
await shot('depot-edit', 390)

await send('Target.closeTarget', { targetId: target.id }).catch(() => {})
console.log(failed ? `${failed} setup check(s) failed` : 'all setup checks passed')
process.exit(failed ? 1 : 0)
