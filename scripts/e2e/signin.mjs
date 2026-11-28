// Drives the dashboard sign-in flow in Chrome over the DevTools protocol. Run it through scripts/e2e-dashboard.sh.
//   node scripts/e2e/signin.mjs <chrome-debug-port> <dashboard-url> <screenshot-dir> <email> <password>
// Set COLOR_SCHEME=light or COLOR_SCHEME=dark to emulate the OS theme, so the screenshots show that theme.
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
  // A DOM node does not survive returnByValue, so test the expression as a boolean inside the page.
  for (const end = Date.now() + ms; Date.now() < end; await sleep(100)) if (await js(`!!(${expr})`)) return true
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
// The path and query string the address bar shows, such as /sign-in?redirect=%2Fdrivers.
const url = () => js('location.pathname + location.search')
const atUrl = (path) => until(`location.pathname + location.search === ${JSON.stringify(path)}`)
const back = async () => { await js('history.back(), true') }
const RAISED = { light: 'rgb(245, 246, 247)', dark: 'rgb(14, 15, 16)' }
const sidebarBg = () => js('getComputedStyle(document.querySelector("[data-slot=sidebar-inner]")).backgroundColor')
const pressedTheme = () => js(`document.querySelector('[aria-label$=" theme"][aria-pressed="true"]')?.getAttribute('aria-label')`)
let failed = 0
const check = (label, cond, detail) => {
  if (!cond) failed++
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${cond || !detail ? '' : `  [${detail}]`}`)
}

await send('Page.enable'); await send('Runtime.enable')
if (process.env.COLOR_SCHEME) await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: process.env.COLOR_SCHEME }] })
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false })
await go(base)
await js(`localStorage.clear(); document.cookie = 'sidebar_state=; path=/; max-age=0'`); await go(base)
check('opens on sign-in, no landing page', (await text()).startsWith('Sign in to Nextsci'), await text())
check('the sign-in page has its own document title', (await js('document.title')) === 'Sign in · Nextsci', await js('document.title'))
await shot('dash-signin')

await go(`${base}drivers`)
check('signed-out visit to /drivers goes to sign-in and keeps the path', (await url()) === '/sign-in?redirect=%2Fdrivers' && (await text()).startsWith('Sign in to Nextsci'), await url())
await shot('dash-signin-redirect')

await submit(email, 'wrong-password'); await until('document.querySelector("[role=alert]")')
const err = await js('document.querySelector("[role=alert]")?.textContent')
check('wrong password shows error', err === 'The email or password is incorrect.', err)
await shot('dash-error')

await submit(email, password); await until('document.querySelector("[data-slot=sidebar-wrapper]")')
let t = await text()
check('right password signs in and shows email', t.includes(email), t)
await atUrl('/drivers')
check('signing in returns to the page that asked for it', (await url()) === '/drivers' && (await heading()) === 'Drivers', `${await url()} ${await heading()}`)
check('each screen has its own document title', (await js('document.title')) === 'Drivers · Nextsci', await js('document.title'))

let bar = await sidebar()
check('sidebar starts expanded with the Routes label showing', bar?.state === 'expanded' && bar.width > 200 && bar.routesLabelVisible, JSON.stringify(bar))
await go(base); await atUrl('/onboarding')
check('/ opens on the setup checklist while nothing is planned', (await url()) === '/onboarding' && (await heading()) === 'Get started', `${await url()} ${await heading()}`)
await shot('dash-home')

for (const theme of ['light', 'dark']) {
  const label = `${theme[0].toUpperCase()}${theme.slice(1)} theme`
  await clickAt(`document.querySelector('header [aria-label="${label}"]')`); await sleep(200)
  const bg = await sidebarBg()
  check(`the header switch turns the sidebar ${theme}`, bg === RAISED[theme] && (await pressedTheme()) === label, bg)
}
await clickAt(`document.querySelector('header [aria-label="System theme"]')`); await sleep(200)
check('the header switch returns to the system theme', (await pressedTheme()) === 'System theme' && !(await js('document.documentElement.dataset.theme')))

await go(`${base}routes`); await atUrl('/routes'); t = await text()
check('Routes without a plan says so', (await heading()) === 'Routes' && t.includes('No routes yet'), t)
const stopsLink = await js(`(() => { const a = ${navButton('Stops')}; return a && { tag: a.tagName, href: a.getAttribute('href') } })()`)
check('sidebar items are links, so they open in a new tab', stopsLink?.tag === 'A' && stopsLink.href === '/stops', JSON.stringify(stopsLink))
await clickAt(navButton('Stops')); await atUrl('/stops')
const current = await js(`document.querySelector('[data-slot=sidebar] [aria-current=page]')?.textContent`)
check('clicking Stops opens /stops and marks it current', (await url()) === '/stops' && (await heading()) === 'Stops' && current === 'Stops', `${await url()} ${await heading()} ${current}`)
await back(); await atUrl('/routes')
check('browser back returns to Routes', (await url()) === '/routes' && (await heading()) === 'Routes', `${await url()} ${await heading()}`)

await clickAt(navButton('Drivers')); await atUrl('/drivers')
check('clicking Drivers switches the main heading', (await heading()) === 'Drivers', await heading())

await clickAt('document.querySelector("[data-sidebar=trigger]")'); await sleep(500)
bar = await sidebar()
check('trigger collapses the sidebar to icons', bar?.state === 'collapsed' && bar.width < 64 && !bar.routesLabelVisible, JSON.stringify(bar))
await shot('dash-drivers-collapsed')
await hoverAt(navButton('Stops')); await sleep(400)
const tip = await js('document.querySelector("[data-slot=tooltip-content]")?.textContent')
check('hovering a collapsed icon shows its label', tip === 'Stops', tip)
await shot('dash-tooltip')
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 0, y: 0 }); await sleep(300)

await clickAt(navButton('Depots')); await atUrl('/depots')
await send('Page.reload'); await sleep(300); await until('document.querySelector("[data-slot=sidebar-wrapper]")')
check('reload on /depots stays on Depots', (await url()) === '/depots' && (await heading()) === 'Depots', `${await url()} ${await heading()}`)
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

await go(`${base}no-such-page`)
const notFound = await js(`(() => {
  const a = [...document.querySelectorAll('main a')].find((l) => l.textContent === 'Go to Routes')
  return { title: document.querySelector('main h2')?.textContent, link: a?.getAttribute('href'), shell: !!document.querySelector('[data-slot=sidebar]') }
})()`)
check('an unknown path shows the not-found page in the shell', notFound.title === 'Page not found' && notFound.shell && (await heading()) === 'Page not found', JSON.stringify(notFound))
await shot('dash-not-found')
await clickAt(`[...document.querySelectorAll('main a')].find((l) => l.textContent === 'Go to Routes')`); await atUrl('/routes')
check('the not-found page links back to Routes', (await url()) === '/routes' && (await heading()) === 'Routes', `${await url()} ${await heading()}`)
await go(`${base}routes/no-such-route`)
const marked = await js(`document.querySelectorAll('[data-slot=sidebar] [aria-current], [data-slot=sidebar] [data-active]').length`)
check('a not-found path under /routes marks no section current', (await heading()) === 'Page not found' && marked === 0 && (await js('document.title')) === 'Page not found · Nextsci', `${await heading()} ${marked}`)

await go(`${base}sign-in`); await atUrl('/onboarding')
check('signed-in visit to /sign-in goes to the start screen', (await url()) === '/onboarding' && (await heading()) === 'Get started', `${await url()} ${await heading()}`)

await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
await sleep(500)
check('signed in, no horizontal scroll at 390px', !(await js('document.documentElement.scrollWidth > innerWidth')))
await shot('dash-home-phone')
await clickAt('document.querySelector("[data-sidebar=trigger]")'); await sleep(500)
check('trigger opens the navigation sheet on a phone', await js(`!!document.querySelector('[data-mobile=true]')?.textContent.includes('Depots')`))
await shot('dash-sidebar-phone')
await clickAt(navButton('Stops', '[data-mobile=true]')); await sleep(500)
check('choosing a section in the sheet shows it and closes the sheet', (await url()) === '/stops' && (await heading()) === 'Stops' && !(await js('!!document.querySelector("[data-mobile=true]")')), `${await url()} ${await heading()}`)

await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false })
await sleep(500)
await clickAt('document.querySelector("[data-slot=sidebar-footer] [data-sidebar=menu-button]")'); await sleep(400)
await shot('dash-user-menu')
await clickAt(`[...document.querySelectorAll('[role=menuitem]')].find((i) => i.textContent.trim() === 'Sign out')`); await atUrl('/sign-in')
check('sign out from the footer menu returns to sign-in and clears storage', (await url()) === '/sign-in' && (await text()).startsWith('Sign in to Nextsci') && (await js('localStorage.getItem("nextsci.session")')) === null, await url())
await go(`${base}routes`)
check('after sign out, /routes goes to sign-in', (await url()) === '/sign-in?redirect=%2Froutes', await url())
await go(`${base}no-such-page`)
check('signed-out visit to an unknown path goes to sign-in', (await url()) === '/sign-in?redirect=%2Fno-such-page', await url())

// A redirect that leaves this origin is dropped, so signing in opens the start screen instead.
for (const target of ['//evil.example', 'https://evil.example/', '/\\evil.example']) {
  await go(`${base}sign-in?redirect=${encodeURIComponent(target)}`)
  await submit(email, password); await until('document.querySelector("[data-slot=sidebar-wrapper]")'); await atUrl('/onboarding')
  check(`sign-in ignores the redirect ${target}`, (await js('location.origin')) === new URL(base).origin && (await url()) === '/onboarding', `${await js('location.href')}`)
  await js('localStorage.clear(), true')
}
await go(`${base}sign-in`)

await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
await sleep(400); await shot('dash-signin-phone')
const overflow = await js('document.documentElement.scrollWidth > innerWidth')
check('no horizontal scroll at 390px', !overflow)
ws.close()
process.exit(failed ? 1 : 0)
