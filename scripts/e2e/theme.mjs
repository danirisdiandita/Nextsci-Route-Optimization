#!/usr/bin/env node
// End-to-end test of the light, dark, and system theme switch in a running app.
//   node scripts/e2e/theme.mjs <url>
// Works on the dashboard sign-in screen and on the website. Exits 1 if any check fails.
// Set CHROME to the browser binary if it is not in the default location.
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const [url] = process.argv.slice(2)
if (!url) {
  console.error('usage: node scripts/e2e/theme.mjs <url>')
  process.exit(1)
}
const LIGHT_BG = 'rgb(252, 252, 253)'
const DARK_BG = 'rgb(8, 9, 10)'
const chrome =
  process.env.CHROME ??
  (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : 'google-chrome')
const profile = mkdtempSync(join(tmpdir(), 'theme-'))
const port = 9300 + Math.floor(Math.random() * 500)
const browser = spawn(chrome, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let failed = 0

try {
  let target
  for (let i = 0; i < 50 && !target; i++) {
    target = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' }).then((r) => r.json()).catch(() => null)
    if (!target) await sleep(100)
  }
  if (!target) throw new Error(`Chrome did not start. Set CHROME to the browser binary (tried ${chrome}).`)
  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((r) => ws.addEventListener('open', r, { once: true }))
  let id = 0
  const pending = new Map()
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data)
    pending.get(m.id)?.(m)
  })
  const send = (method, params = {}) =>
    new Promise((r) => {
      pending.set(++id, r)
      ws.send(JSON.stringify({ id, method, params }))
    })
  const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.result.value
  const os = (scheme) => send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] })
  const open = async () => {
    await send('Page.navigate', { url })
    await sleep(2000)
  }
  const click = async (label) => {
    await evaluate(`document.querySelector('[aria-label="${label}"]').click()`)
    await sleep(200)
  }
  const state = () =>
    evaluate(`JSON.stringify({
      bg: getComputedStyle(document.body).backgroundColor,
      attr: document.documentElement.dataset.theme ?? null,
      saved: JSON.parse(localStorage.getItem('nextsci.theme'))?.state?.preference ?? null,
      pressed: [...document.querySelectorAll('[aria-label$=" theme"][aria-pressed="true"]')].map((b) => b.getAttribute('aria-label')),
    })`).then(JSON.parse)
  const check = async (name, want) => {
    const got = await state()
    const bad = Object.entries(want).filter(([k, v]) => JSON.stringify(got[k]) !== JSON.stringify(v))
    if (bad.length) failed++
    console.log(`${bad.length ? 'FAIL' : 'ok  '} ${name}${bad.length ? `  got ${JSON.stringify(got)}` : ''}`)
  }

  await send('Page.enable')
  await os('dark')
  await open()
  await check('first visit follows a dark OS', { bg: DARK_BG, attr: null, pressed: ['System theme'] })
  await os('light')
  await check('system follows the OS when it turns light', { bg: LIGHT_BG, attr: null })
  await os('dark')
  await click('Light theme')
  await check('light choice overrides a dark OS', { bg: LIGHT_BG, attr: 'light', saved: 'light', pressed: ['Light theme'] })
  await open()
  await check('light choice survives a reload', { bg: LIGHT_BG, attr: 'light', pressed: ['Light theme'] })
  await os('light')
  await click('Dark theme')
  await check('dark choice overrides a light OS', { bg: DARK_BG, attr: 'dark', saved: 'dark', pressed: ['Dark theme'] })
  await click('System theme')
  await check('system choice returns to the OS', { bg: LIGHT_BG, attr: null, saved: 'system', pressed: ['System theme'] })
  await evaluate(`localStorage.setItem('nextsci.theme', '{"state":{"preference":"purple"},"version":0}')`)
  await open()
  await check('an invalid saved value falls back to system', { bg: LIGHT_BG, attr: null, pressed: ['System theme'] })
  await send('Browser.close')
} finally {
  if (browser.exitCode === null) {
    const exited = new Promise((r) => browser.once('exit', r))
    browser.kill()
    await exited
  }
  for (const wait of [0, 1000]) {
    await sleep(wait)
    try {
      rmSync(profile, { recursive: true, force: true })
      break
    } catch {}
  }
}
process.exit(failed ? 1 : 0)
