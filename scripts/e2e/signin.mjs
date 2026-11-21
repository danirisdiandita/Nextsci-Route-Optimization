// Drives the dashboard sign-in flow in Chrome over the DevTools protocol. Run it through scripts/e2e-dashboard.sh.
//   node scripts/e2e/signin.mjs <chrome-debug-port> <dashboard-url> <screenshot-dir> <email> <password>
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
const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); (await import('node:fs')).writeFileSync(`${out}/${name}.png`, Buffer.from(r.result.data, 'base64')) }
const text = () => js('document.body.innerText.replace(/\\s+/g, " ").trim()')
const submit = (email, pw) => js(`(() => { const f = document.querySelector('form'); f.email.value = ${JSON.stringify(email)}; f.password.value = ${JSON.stringify(pw)}; f.requestSubmit(); return true })()`)
// Polls until an expression is truthy. The server's response time varies, so fixed sleeps race it.
const until = async (expr, ms = 10000) => {
  for (const end = Date.now() + ms; Date.now() < end; await sleep(100)) if (await js(expr)) return true
  return false
}
// Waits until the session check settles on the sign-in form or the signed-in shell.
const go = async (url) => { await send('Page.navigate', { url }); await sleep(300); await until('document.querySelector("form, [data-slot=sidebar-wrapper]")') }
const centerOf = (expr) => js(`(() => { const r = (${expr})?.getBoundingClientRect(); return r && { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
const hoverAt = async (expr) => { const at = await centerOf(expr); if (at) await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...at }) }
// Clicks the element an expression returns with real mouse events, then moves the pointer off so no tooltip lingers.
const clickAt = async (expr) => {
  const at = await centerOf(expr)
  if (!at) return
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...at })
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...at, button: 'left', clickCount: 1 })
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...at, button: 'left', clickCount: 1 })
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 0, y: 0 })
}
const pressCtrlB = async () => {
  for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key: 'b', code: 'KeyB', windowsVirtualKeyCode: 66, modifiers: 2 })
  await sleep(500)
}
const navButton = (label, scope = '[data-slot=sidebar]') =>
  `[...document.querySelectorAll('${scope} [data-sidebar=menu-button]')].find((b) => b.textContent === ${JSON.stringify(label)})`
const sidebar = () => js(`(() => {
  const s = document.querySelector('[data-slot=sidebar]')
  const box = s?.querySelector('[data-slot=sidebar-container]')?.getBoundingClientRect()
  const label = [...document.querySelectorAll('[data-slot=sidebar] [data-sidebar=menu-button] span')].find((e) => e.textContent === 'Routes')
  return s && { state: s.dataset.state, width: Math.round(box.width), routesLabelVisible: !!label?.checkVisibility({ opacityProperty: true }) }
})()`)
const heading = () => js('document.querySelector("main h1")?.textContent')
let failed = 0
const check = (label, cond, detail) => {
  if (!cond) failed++
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${cond || !detail ? '' : `  [${detail}]`}`)
}

await send('Page.enable'); await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false })
await go(base)
await js(`localStorage.clear(); document.cookie = 'sidebar_state=; path=/; max-age=0'`); await go(base)
check('opens on sign-in, no landing page', (await text()).startsWith('Sign in to Nextsci'), await text())
await shot('dash-signin')

await submit(email, 'wrong-password'); await until('document.querySelector("[role=alert]")')
const err = await js('document.querySelector("[role=alert]")?.textContent')
check('wrong password shows error', err === 'The email or password is incorrect.', err)
await shot('dash-error')

await submit(email, password); await until('document.querySelector("[data-slot=sidebar-wrapper]")')
let t = await text()
check('right password signs in and shows email', t.includes(email), t)

let bar = await sidebar()
check('sidebar starts expanded with the Routes label showing', bar?.state === 'expanded' && bar.width > 200 && bar.routesLabelVisible, JSON.stringify(bar))
check('main area opens on Routes', (await heading()) === 'Routes' && t.includes('No routes yet'), await heading())
await shot('dash-home')

await clickAt(navButton('Drivers')); await sleep(300)
check('clicking Drivers switches the main heading', (await heading()) === 'Drivers' && (await text()).includes('No drivers yet'), await heading())

await clickAt('document.querySelector("[data-sidebar=trigger]")'); await sleep(500)
bar = await sidebar()
check('trigger collapses the sidebar to icons', bar?.state === 'collapsed' && bar.width < 64 && !bar.routesLabelVisible, JSON.stringify(bar))
await shot('dash-home-collapsed')
await hoverAt(navButton('Stops')); await sleep(400)
const tip = await js('document.querySelector("[data-slot=tooltip-content]")?.textContent')
check('hovering a collapsed icon shows its label', tip === 'Stops', tip)
await shot('dash-tooltip')
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 0, y: 0 }); await sleep(300)

await go(base)
bar = await sidebar()
check('sidebar stays collapsed after reload', bar?.state === 'collapsed' && bar.width < 64, JSON.stringify(bar))
check('reload keeps the session', (await text()).includes(email))

await pressCtrlB()
const afterOne = (await sidebar())?.state
await pressCtrlB()
const afterTwo = (await sidebar())?.state
check('Ctrl+B toggles the sidebar', afterOne === 'expanded' && afterTwo === 'collapsed', `${afterOne}, ${afterTwo}`)

await js(`(() => { const s = JSON.parse(localStorage.getItem('nextsci.session')); s.access = 'expired'; localStorage.setItem('nextsci.session', JSON.stringify(s)); return true })()`)
await go(base)
t = await text()
const renewed = await js(`JSON.parse(localStorage.getItem('nextsci.session')).access !== 'expired'`)
check('expired access token refreshes silently', t.includes(email) && renewed, t)

await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
await sleep(500)
check('signed in, no horizontal scroll at 390px', !(await js('document.documentElement.scrollWidth > innerWidth')))
await shot('dash-home-phone')
await clickAt('document.querySelector("[data-sidebar=trigger]")'); await sleep(500)
check('trigger opens the navigation sheet on a phone', await js(`!!document.querySelector('[data-mobile=true]')?.textContent.includes('Depots')`))
await shot('dash-sidebar-phone')
await clickAt(navButton('Stops', '[data-mobile=true]')); await sleep(500)
check('choosing a section in the sheet shows it and closes the sheet', (await heading()) === 'Stops' && !(await js('!!document.querySelector("[data-mobile=true]")')), await heading())

await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false })
await sleep(500)
await clickAt('document.querySelector("[data-slot=sidebar-footer] [data-sidebar=menu-button]")'); await sleep(400)
await shot('dash-user-menu')
await clickAt(`[...document.querySelectorAll('[role=menuitem]')].find((i) => i.textContent.trim() === 'Sign out')`); await sleep(500)
check('sign out from the footer menu returns to sign-in and clears storage', (await text()).startsWith('Sign in to Nextsci') && (await js('localStorage.getItem("nextsci.session")')) === null)

await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
await sleep(400); await shot('dash-signin-phone')
const overflow = await js('document.documentElement.scrollWidth > innerWidth')
check('no horizontal scroll at 390px', !overflow)
ws.close()
process.exit(failed ? 1 : 0)
