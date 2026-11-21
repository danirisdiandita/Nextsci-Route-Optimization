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
const go = async (url) => { await send('Page.navigate', { url }); await sleep(1500) }
let failed = 0
const check = (label, cond, detail) => {
  if (!cond) failed++
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${cond || !detail ? '' : `  [${detail}]`}`)
}

await send('Page.enable'); await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false })
await go(base)
await js('localStorage.clear()'); await go(base)
check('opens on sign-in, no landing page', (await text()).startsWith('Sign in to Nextsci'), await text())
await shot('dash-signin')

await submit(email, 'wrong-password'); await sleep(1200)
const err = await js('document.querySelector("[role=alert]")?.textContent')
check('wrong password shows error', err === 'The email or password is incorrect.', err)
await shot('dash-error')

await submit(email, password); await sleep(1500)
let t = await text()
check('right password signs in and shows email', t.includes(email) && t.includes('Sign out'), t)
await shot('dash-home')

await go(base)
check('reload keeps the session', (await text()).includes(email))

await js(`(() => { const s = JSON.parse(localStorage.getItem('nextsci.session')); s.access = 'expired'; localStorage.setItem('nextsci.session', JSON.stringify(s)); return true })()`)
await go(base)
t = await text()
const renewed = await js(`JSON.parse(localStorage.getItem('nextsci.session')).access !== 'expired'`)
check('expired access token refreshes silently', t.includes(email) && renewed, t)

await js('[...document.querySelectorAll("button")].find(b => b.textContent === "Sign out").click()'); await sleep(500)
check('sign out returns to sign-in and clears storage', (await text()).startsWith('Sign in to Nextsci') && (await js('localStorage.getItem("nextsci.session")')) === null)

await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
await sleep(400); await shot('dash-signin-phone')
const overflow = await js('document.documentElement.scrollWidth > innerWidth')
check('no horizontal scroll at 390px', !overflow)
ws.close()
process.exit(failed ? 1 : 0)
