// Walks the stops screens in Chrome with real clicks and typing: import a CSV file, match its columns, fix the
// addresses, then list, search, add, edit, and delete stops, checking that each change survives a reload.
//   node scripts/e2e/stops.mjs <chrome-debug-port> <dashboard-url> <screenshot-dir> <email> <password>
// scripts/e2e-dashboard.sh runs it after the tour. Set COLOR_SCHEME=light or dark for the screenshots.
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

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
const go = async (path) => { await send('Page.navigate', { url: new URL(path, base).href }); await sleep(300); await until('document.querySelector("[data-slot=sidebar-wrapper]")') }
const reload = async () => { await send('Page.reload'); await sleep(300); await until('document.querySelector("[data-slot=sidebar-wrapper]")') }
const shot = async (name) => { await sleep(400); const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(`${out}/${name}.png`, Buffer.from(r.result.data, 'base64')) }
const setWidth = (width) => send('Emulation.setDeviceMetricsOverride', { width, height: 800, deviceScaleFactor: 1, mobile: false })
const q = (s) => JSON.stringify(s)
const byText = (selector, text) => `[...document.querySelectorAll(${q(selector)})].find((e) => e.textContent.replace(/\\s+/g, ' ').trim() === ${q(text)})`
const byTextStart = (selector, text) => `[...document.querySelectorAll(${q(selector)})].find((e) => e.textContent.replace(/\\s+/g, ' ').trim().startsWith(${q(text)}))`
// Real mouse events at the element's center, which Base UI menus, checkboxes, and the map need.
const clickAt = async (expr, dx = 0.5, dy = 0.5) => {
  await until(expr)
  const at = await js(`(() => { const el = ${expr}; el?.scrollIntoView({ block: 'center' }); const r = el?.getBoundingClientRect(); return r && { x: r.x + r.width * ${dx}, y: r.y + r.height * ${dy} } })()`)
  if (!at) return false
  for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, ...at, button: 'left', clickCount: 1 })
  return true
}
// Focuses a field, selects what it holds, and types over it as a keyboard would.
const typeInto = async (expr, text) => {
  await until(expr)
  await js(`(() => { const el = ${expr}; el.focus(); el.select?.(); return true })()`)
  if (text) await send('Input.insertText', { text })
  else await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Backspace', windowsVirtualKeyCode: 8 })
}
// Opens a Base UI select and picks an option once the list is open, as a person would.
const pick = async (trigger, option) => {
  await clickAt(trigger)
  await until(`${byText('[role=option]', option)}?.checkVisibility()`)
  await sleep(250)
  await clickAt(byText('[role=option]', option))
  await until('!document.querySelector("[role=listbox]")')
}
const mock = (module, call) => js(`import('/src/api/mock/${module}.ts').then((m) => ${call}).then((r) => JSON.parse(JSON.stringify(r ?? null)))`)
const stopCount = async () => (await mock('order', 'm.listOrders()')).length

let failed = 0
const check = async (name, holds, detail = async () => '') => {
  let ok = false
  for (const end = Date.now() + 5000; !(ok = Boolean(await holds())) && Date.now() < end; ) await sleep(100)
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `  (${await detail()})`}`)
  if (!ok) failed++
}

const features = [{ name: 'prefers-reduced-motion', value: 'reduce' }]
if (process.env.COLOR_SCHEME) features.push({ name: 'prefers-color-scheme', value: process.env.COLOR_SCHEME })
await send('Emulation.setEmulatedMedia', { features })
await setWidth(1280)

await go('/sign-in')
if (await js('!!document.querySelector("form input[name=email]")')) {
  await js(`(() => { const f = document.querySelector('form'); f.email.value = ${q(email)}; f.password.value = ${q(password)}; f.requestSubmit(); return true })()`)
  await until('document.querySelector("[data-slot=sidebar-wrapper]")')
}
await js('localStorage.removeItem("nextsci.mock.v1"); localStorage.removeItem("nextsci.agentPanel")')

// The sample workspace gives the import a depot and drivers to weigh the load against. Its stops go first.
await mock('workspace', 'm.resetDemo()')
await mock('order', 'm.listOrders().then((os) => m.deleteOrders(os.map((o) => o.id)))')
await go('/stops')
await check('a workspace without stops offers to import', async () => (await main()).includes('No stops yet'), main)
await shot('stops-empty')

const csv = [
  'Customer,Street address,Delivery time,Boxes,Remarks',
  'Toko Sinar Jaya,"Jl. Kaliurang km 7 gg. Mawar",10.00-12.00,4,Titip di satpam',
  'Kopi Lor,Jl. Magelang,,2,',
  'Pak Hadi,belakang masjid,13.00-15.00,3,',
  'Warung Pojok,Jl. Parangtritis No.45,09.00-11.00,5,Pintu samping',
  'Bu Ratna,Jl. Prawirotaman No. 12,,2,',
  'No Address Shop,,,1,',
].join('\n')
const file = join(out, 'stops-e2e.csv')
writeFileSync(file, csv)

await go('/stops/import')
await check('the import starts on the upload step', async () => (await main()).includes('Drop a CSV file here'), main)
await shot('stops-import-upload')
const { root } = (await send('DOM.getDocument')).result
const { nodeId } = (await send('DOM.querySelector', { nodeId: root.nodeId, selector: 'input[type=file]' })).result
await send('DOM.setFileInputFiles', { nodeId, files: [file] })
await until('/^\\/stops\\/import\\/order_import_/.test(location.pathname)')
await check('choosing a CSV file opens its column matching', async () => /^\/stops\/import\/order_import_/.test(await url()) && (await main()).includes('stops-e2e.csv 6 rows'), async () => `${await url()} ${await main()}`)
const fieldOf = (column) => js(`document.querySelector('[aria-label="Nextsci field for ${column}"] [data-slot=select-value]')?.textContent.trim()`)
await check('the guessed mapping fills name, address, window, and load', async () =>
  (await fieldOf('Customer')) === 'Customer name' && (await fieldOf('Street address')) === 'Address' && (await fieldOf('Delivery time')) === 'Time window' && (await fieldOf('Boxes')) === 'Load (boxes)',
  async () => [await fieldOf('Customer'), await fieldOf('Street address'), await fieldOf('Delivery time'), await fieldOf('Boxes')].join(' | '))
await check('an unknown header is left out', async () => (await fieldOf('Remarks')) === "Don't import", async () => await fieldOf('Remarks'))
await pick(`document.querySelector('[aria-label="Nextsci field for Remarks"]')`, 'Notes for driver')
await check('picking a field for a column saves the mapping', async () => (await fieldOf('Remarks')) === 'Notes for driver', async () => await fieldOf('Remarks'))
await check('the preview lists the row it will skip', async () => (await main()).includes('Skipped: row 7 (no address)'), main)
await shot('stops-import-mapping')
await reload()
await check('the mapping survives a reload', async () => (await fieldOf('Remarks')) === 'Notes for driver', async () => await fieldOf('Remarks'))

await clickAt(byText('main button', 'Find addresses'))
await until('location.pathname === "/stops/review"')
await check('Find addresses imports the rows and opens the review', async () => (await url()) === '/stops/review' && (await stopCount()) === 5, async () => `${await url()} ${await stopCount()}`)
await check('the review weighs the load against the fleet', async () => /Load is 16 boxes\. Your drivers carry \d+ per trip\./.test(await main()), main)
await check('the review opens on the addresses to check', async () => (await main()).includes('Check address 2') && (await main()).includes('Not found 1'), main)
await check('the first address to check shows its matches', async () => await js(`document.querySelectorAll('[role=radio]').length === 2`))
await check('the remembered notes column reached the stop', async () => (await mock('order', 'm.listOrders()')).some((o) => o.notes === 'Titip di satpam'))
await shot('stops-review')

await clickAt(byText('main label', 'Jl. Kaliurang Km 7, Condongcatur, Sleman'))
await check('choosing a match fixes the address', async () => (await main()).includes('Check address 1'), main)
const sinar = await mock('order', `m.listOrders().then((os) => os.find((o) => o.customer === 'Toko Sinar Jaya'))`)
await check('the stop takes the chosen place', async () => sinar.geocode.status === 'ok' && sinar.geocode.address.includes('Condongcatur'), async () => JSON.stringify(sinar.geocode))
await clickAt(byText('main button', 'Keep this place'))
await check('keeping a street-only guess clears the last check', async () => (await main()).includes('Check address 0'), main)

await clickAt(byTextStart('main [role=group] button', 'Not found'))
await check('the not found tab shows the unplaced stop', async () => (await main()).includes('Pak Hadi'), main)
await clickAt(byText('main button', 'Or drop the pin on the map'))
await check('pin mode asks for a click on the map', async () => (await main()).includes('Click where Pak Hadi is'), main)
await shot('stops-review-pin')
await clickAt(`document.querySelector('svg[aria-label^="Map of"]')`, 0.4, 0.6)
await check('a click on the map places the pin', async () => (await mock('order', `m.listOrders().then((os) => os.find((o) => o.customer === 'Pak Hadi').geocode.status)`)) === 'manual')
await reload()
await check('the fixes survive a reload', async () => (await main()).includes('Ready 5') && (await main()).includes('Not found 0'), main)
await setWidth(390)
await shot('stops-review-390')
await setWidth(1280)

await clickAt(byText('header button', 'Save 5 stops'))
await until('location.pathname === "/routes/new"')
await check('saving the review goes on to plan routes', async () => (await url()) === '/routes/new', url)

await go('/stops')
await check('the list shows every stop', async () => (await main()).includes('5 stops · 5 ready'), main)
await typeInto('document.querySelector("input[aria-label=\'Search stops\']")', 'parangtritis')
await check('search filters by address', async () => (await js('document.querySelectorAll("main tbody tr").length')) === 1 && (await main()).includes('Warung Pojok'), main)
await typeInto('document.querySelector("input[aria-label=\'Search stops\']")', '')
await pick(`document.querySelector('[aria-label="Time window"]')`, 'Has a time window')
await check('the window filter keeps stops with a window', async () => (await js('document.querySelectorAll("main tbody tr").length')) === 3, async () => await js('document.querySelectorAll("main tbody tr").length'))
await shot('stops-list-filtered')
await pick(`document.querySelector('[aria-label="Time window"]')`, 'Any window')
await check('the window filter goes back to every stop', async () => (await js('document.querySelectorAll("main tbody tr").length')) === 5)
await clickAt(`document.querySelector('[aria-label="Select Kopi Lor"]')`)
await clickAt(`document.querySelector('[aria-label="Select Bu Ratna"]')`)
await check('selecting rows offers a bulk delete', async () => (await main()).includes('2 selected'), main)
await clickAt(byText('main button', 'Delete'))
await until('document.querySelector("[role=alertdialog]")')
await shot('stops-delete-confirm')
await clickAt(byText('[role=alertdialog] button', 'Delete'))
await check('bulk delete removes the selected stops', async () => (await main()).includes('3 stops'), main)
await reload()
await check('the bulk delete survives a reload', async () => (await main()).includes('3 stops') && !(await main()).includes('Kopi Lor'), main)
await setWidth(390)
await shot('stops-list-390')
await setWidth(1280)
await shot('stops-list')

await clickAt(`document.querySelector('header a[href="/stops/new"]')`)
await until('location.pathname === "/stops/new"')
await typeInto('document.getElementById("stop-customer")', 'Kedai Malioboro')
await typeInto('document.getElementById("stop-addressRaw")', 'Jl. Malioboro No. 60')
await typeInto('document.getElementById("stop-quantity")', '0')
await clickAt(byText('main button', 'Add stop'))
await check('the form explains a bad load', async () => (await main()).includes('Load must be a whole number'), main)
await typeInto('document.getElementById("stop-quantity")', '3')
await shot('stops-new')
await clickAt(byText('main button', 'Add stop'))
await until('/^\\/stops\\/order_/.test(location.pathname)')
const newPath = await url()
await check('adding a stop opens it with its placed address', async () => /^\/stops\/order_/.test(newPath) && (await main()).includes('Jl. Malioboro No.60, Sosromenduran'), async () => `${newPath} ${await main()}`)
await typeInto('document.getElementById("stop-addressRaw")', 'belakang pasar')
await clickAt(byText('main button', 'Save changes'))
await check('changing the address places it again and shows the result', async () => (await main()).includes('"belakang pasar" is not on the map'), main)
await reload()
await check('the edit survives a reload', async () => (await js('document.getElementById("stop-addressRaw")?.value')) === 'belakang pasar' && (await main()).includes('Not found'), main)
await shot('stop-edit')
await setWidth(390)
await shot('stop-edit-390')
await setWidth(1280)
await clickAt(byText('main button', 'Delete stop'))
await until('document.querySelector("[role=alertdialog]")')
await clickAt(byText('[role=alertdialog] button', 'Delete stop'))
await until('location.pathname === "/stops"')
await check('deleting a stop returns to the list without it', async () => (await url()) === '/stops' && (await main()).includes('3 stops') && !(await main()).includes('Kedai Malioboro'), main)
await go(newPath)
await check('a deleted stop shows a readable error', async () => (await main()).includes('This stop no longer exists.'), main)
await check('the stop list is not a setup step once setup is done', async () => !(await header()).includes('Setup step'), header)

// Close only this tab: the next script in e2e-dashboard.sh drives the same Chrome.
await Promise.race([send('Page.close'), sleep(1000)])
console.log(failed ? `${failed} stops check(s) failed` : 'all stops checks passed')
process.exit(failed ? 1 : 0)
