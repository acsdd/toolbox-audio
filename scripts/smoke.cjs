/* End-to-end smoke for the ArtistWave shell against the real remote page. */
const assert = require('node:assert/strict')
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'artistwave-smoke-'))
app.setPath('userData', userData)
const appMain = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, 'desktop.cjs')
require(appMain)

const APP_PREFIX = 'https://28121978444.github.io/ArtistWave/'
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function waitForWindow() {
  const started = Date.now()
  while (Date.now() - started < 20000) {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
      if (win.webContents.isLoading()) {
        await new Promise((resolve) => win.webContents.once('did-finish-load', resolve))
      }
      return win
    }
    await delay(150)
  }
  throw new Error('No BrowserWindow appeared within the timeout.')
}

function frame(win) {
  return win.webContents.mainFrame
}

async function waitReady(win, timeoutMs = 30000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const ready = await frame(win).executeJavaScript(
      `(() => { const h = window.ArtistWaveMiniHost; try { return !!(h && h.state && h.state().ready) } catch { return false } })()`,
      false
    )
    if (ready) return
    await delay(300)
  }
  throw new Error('ArtistWave player did not become ready.')
}

const watchdog = setTimeout(() => { console.error('Smoke timed out'); app.exit(1) }, 120000)

app.whenReady().then(async () => {
  const win = await waitForWindow()
  win.show()
  await waitReady(win)
  await delay(600)

  const failures = []
  const expect = (cond, msg) => { if (!cond) failures.push(msg) }

  // Top-level load: the app itself must not be framed. The web app legitimately
  // embeds content iframes (YouTube/Studio), so we assert the main frame is the
  // app rather than counting child iframes.
  const top = await frame(win).executeJavaScript(
    `({ url: location.href, framed: window.self !== window.top, iframeSrcs: [...document.querySelectorAll('iframe')].map((f) => f.src), api: typeof window.api, proc: typeof window.process })`,
    false
  )
  expect(top.url.startsWith(APP_PREFIX), `page did not load top-level: ${top.url}`)
  expect(top.framed === false, 'the app is loaded inside a wrapper iframe (should be top-level)')
  expect(top.api === 'undefined', 'a preload bridge is exposed (should be none)')
  expect(top.proc === 'undefined', 'process is exposed (sandbox should hide it)')

  const prefs = win.webContents.getLastWebPreferences()
  expect(prefs.sandbox === true, 'sandbox is not enabled')
  expect(prefs.contextIsolation === true, 'contextIsolation is not enabled')
  expect(prefs.nodeIntegration === false, 'nodeIntegration is not disabled')

  // Volume command applies.
  await frame(win).executeJavaScript(`window.ArtistWaveMiniHost.command('volume', 60)`, false)
  await delay(400)
  const vol = await frame(win).executeJavaScript(`window.ArtistWaveMiniHost.state().volume`, false)
  expect(Math.abs(vol - 0.6) <= 0.02, `volume did not apply: ${vol}`)

  // Mini player shrinks the window + always-on-top.
  const beforeMini = win.getBounds().width
  await frame(win).executeJavaScript(`document.getElementById('openMiniPlayer').click()`, false)
  await delay(1200)
  const miniWidth = win.getBounds().width
  expect(miniWidth <= 420, `mini player did not shrink the window: ${miniWidth}`)
  expect(win.isAlwaysOnTop(), 'mini player is not always-on-top')
  const miniActive = await frame(win).executeJavaScript(
    `document.body.classList.contains('mini-player-active')`, false
  )
  expect(miniActive === true, 'web app mini state did not activate')

  // Closing the fallback restores the window.
  await frame(win).executeJavaScript(`window.ArtistWaveMiniHost.closeFallback()`, false)
  await delay(1500)
  const restoredWidth = win.getBounds().width
  expect(restoredWidth >= beforeMini - 40, `window did not restore: ${restoredWidth}`)
  expect(!win.isAlwaysOnTop(), 'always-on-top was not cleared after restore')

  // A non-mini popup is denied (no second window).
  const before = BrowserWindow.getAllWindows().length
  await frame(win).executeJavaScript(`window.open('https://example.com/', '_blank')`, false)
  await delay(600)
  expect(BrowserWindow.getAllWindows().length === before, 'a popup created a second window')

  console.log(JSON.stringify({ ok: failures.length === 0, beforeMini, miniWidth, restoredWidth, vol, iframeSrcs: top.iframeSrcs, failures, userData }))
  clearTimeout(watchdog)
  if (failures.length) { console.error(`SMOKE FAILED (${failures.length})`); app.exit(1) }
  else { console.log('SMOKE PASSED'); app.exit(0) }
}).catch((error) => {
  clearTimeout(watchdog)
  console.error(error && error.stack ? error.stack : String(error))
  app.exit(1)
})