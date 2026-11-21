#!/usr/bin/env node
// Full-page screenshot of a running app at an exact viewport width.
//   node scripts/screenshot.mjs <url> <out.png> [width=1280]
// Uses device emulation, so widths under 500px are real. Chrome's --window-size cannot go below 500px.
// Emulates prefers-reduced-motion, so the capture shows every section in its final state.
// Set COLOR_SCHEME=light or COLOR_SCHEME=dark to emulate the OS theme. The apps follow it unless a visitor picked one.
// Set CHROME to the browser binary if it is not in the default location.
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const [url, out, widthArg = '1280'] = process.argv.slice(2)
if (!url || !out) {
  console.error('usage: node scripts/screenshot.mjs <url> <out.png> [width]')
  process.exit(1)
}
const width = Number(widthArg)
const mobile = width < 720
const chrome =
  process.env.CHROME ??
  (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : 'google-chrome')

const profile = mkdtempSync(join(tmpdir(), 'shot-'))
const port = 9300 + Math.floor(Math.random() * 500)
const browser = spawn(chrome, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

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

  await send('Page.enable')
  // Reduced motion turns off scroll-driven reveals, so sections below the fold render in a full-page capture.
  const features = [{ name: 'prefers-reduced-motion', value: 'reduce' }]
  if (process.env.COLOR_SCHEME) features.push({ name: 'prefers-color-scheme', value: process.env.COLOR_SCHEME })
  await send('Emulation.setEmulatedMedia', { features })
  await send('Emulation.setDeviceMetricsOverride', { width, height: mobile ? 844 : 800, deviceScaleFactor: mobile ? 2 : 1, mobile })
  await send('Page.navigate', { url })
  await sleep(2500)
  const { result } = await send('Runtime.evaluate', {
    expression: 'JSON.stringify([document.documentElement.scrollHeight, document.documentElement.scrollWidth > innerWidth])',
    returnByValue: true,
  })
  const [height, overflows] = JSON.parse(result.result.value)
  const shot = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
    clip: { x: 0, y: 0, width, height, scale: 1 },
  })
  writeFileSync(out, Buffer.from(shot.result.data, 'base64'))
  console.log(`${out}  ${width}x${height}${overflows ? '  WARNING: page scrolls sideways' : ''}`)
  // Browser.close stops Chrome's helper processes too, so none of them still writes to the profile below.
  await send('Browser.close')
} finally {
  if (browser.exitCode === null) {
    const exited = new Promise((r) => browser.once('exit', r))
    browser.kill()
    await exited
  }
  // A Chrome helper can still write to the temporary profile after exit. Retry once, then leave it to the OS.
  for (const wait of [0, 1000]) {
    await sleep(wait)
    try {
      rmSync(profile, { recursive: true, force: true })
      break
    } catch {}
  }
}
