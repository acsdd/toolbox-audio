/* End-to-end smoke for the AudioWave shell and first-party Mini Player widget. */
const assert = require('node:assert/strict')
const { app, BrowserWindow, screen } = require('electron')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'audiowave-smoke-'))
app.setPath('userData', userData)
fs.writeFileSync(path.join(userData, 'widgets.json'), JSON.stringify({ schemaVersion: 1, installed: ['mini-player'] }))
const appMain = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, 'desktop.cjs')
require(appMain)

const APP_PREFIX = 'https://acsdd.github.io/ArtistWave/'
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function waitForWindow(predicate, label, timeoutMs = 20000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const found = BrowserWindow.getAllWindows().find(predicate)
    if (found) {
      if (found.webContents.isLoading()) {
        await new Promise((resolve) => found.webContents.once('did-finish-load', resolve))
      }
      return found
    }
    await delay(150)
  }
  throw new Error(`No ${label} appeared within the timeout.`)
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
  const win = await waitForWindow((item) => item.title === 'AudioWave' || item.getTitle() === 'AudioWave', 'AudioWave main window')
  win.show()
  await waitReady(win)
  await delay(600)

  const failures = []
  const expect = (cond, msg) => { if (!cond) failures.push(msg) }

  const top = await frame(win).executeJavaScript(
    `({ url: location.href, framed: window.self !== window.top, api: typeof window.api, proc: typeof window.process })`,
    false
  )
  expect(top.url.startsWith(APP_PREFIX), `page did not load top-level: ${top.url}`)
  expect(top.framed === false, 'the app is loaded inside a wrapper iframe')
  expect(top.api === 'undefined', 'a preload bridge is exposed to the remote page')
  expect(top.proc === 'undefined', 'process is exposed to the remote page')
  const desktopAuth = await frame(win).executeJavaScript("typeof window.AudioWaveAuth?.signIn")
  expect(desktopAuth === 'function', 'Desktop sign-in bridge is missing')
  const installHidden = await frame(win).executeJavaScript("getComputedStyle(document.getElementById('installAppButton')).display === 'none'")
  expect(installHidden, 'Install button is visible')
  const miniLauncherVisible = await frame(win).executeJavaScript(`(() => {
    const button = document.getElementById('openMiniPlayer');
    const rect = button.getBoundingClientRect();
    return rect.width > 0 && rect.left >= 0 && rect.right <= innerWidth &&
      rect.top >= 0 && rect.bottom <= innerHeight &&
      button.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
  })()`)
  expect(miniLauncherVisible, 'Mini Player button is outside the visible window or covered')

  const prefs = win.webContents.getLastWebPreferences()
  expect(prefs.sandbox === true, 'sandbox is not enabled')
  expect(prefs.contextIsolation === true, 'contextIsolation is not enabled')
  expect(prefs.nodeIntegration === false, 'nodeIntegration is not disabled')

  await frame(win).executeJavaScript(`window.ArtistWaveMiniHost.command('volume', 60)`, false)
  await delay(400)
  const vol = await frame(win).executeJavaScript(`window.ArtistWaveMiniHost.state().volume`, false)
  expect(Math.abs(vol - 0.6) <= 0.02, `volume did not apply: ${vol}`)

  const mainWidthBefore = win.getBounds().width
  const mainXBefore = win.getBounds().x
  const workArea = screen.getDisplayMatching(win.getBounds()).workArea
  await frame(win).executeJavaScript(`document.getElementById('openMiniPlayer').click()`, false)
  await delay(900)
  const miniWidth = win.getBounds().width
  expect(miniWidth === 380, `Mini mode width is ${miniWidth}`)
  expect(win.getBounds().x + miniWidth === workArea.x + workArea.width, 'Mini mode is not aligned to the right edge of the work area')
  expect(win.getBounds().height === workArea.height, 'Mini mode does not fill the work area height')
  expect(win.getBounds().y === workArea.y, 'Mini mode does not start at the top of the work area')
  expect(win.isAlwaysOnTop(), 'Mini mode is not always-on-top')
  expect(BrowserWindow.getAllWindows().length === 1, 'Mini mode opened another window')
  const active = await frame(win).executeJavaScript("document.body.classList.contains('mini-player-active')", false)
  expect(active, 'embedded mini mode is not active')
  const miniControls = await frame(win).executeJavaScript(`(() => {
    const doc = document.getElementById('miniPlayerFallbackFrame').contentDocument
    const pin = doc.getElementById('miniAlwaysOnTop')
    const playlists = doc.getElementById('miniPlaylists')
    return { pinVisible: !pin.hidden, playlistSelector: playlists.tagName === 'SELECT' }
  })()`)
  expect(miniControls.pinVisible, 'Always-on-top button is hidden')
  expect(miniControls.playlistSelector, 'Playlist selector is missing')
  await frame(win).executeJavaScript("document.getElementById('miniPlayerFallbackFrame').contentDocument.getElementById('miniAlwaysOnTop').click()")
  await delay(700)
  expect(!win.isAlwaysOnTop(), 'Always-on-top button did not turn pinning off')
  await frame(win).executeJavaScript("document.getElementById('miniPlayerFallbackFrame').contentDocument.getElementById('miniAlwaysOnTop').click()")
  await delay(700)
  expect(win.isAlwaysOnTop(), 'Always-on-top button did not turn pinning on')
  const miniVolume = await frame(win).executeJavaScript(`window.ArtistWaveMiniHost.state().volume`, false)
  await frame(win).executeJavaScript('window.ArtistWaveMiniHost.closeFallback()', false)
  await delay(900)
  expect(win.getBounds().width === mainWidthBefore, 'Full player width was not restored')
  expect(win.getBounds().x === mainXBefore, 'Full player horizontal position was not restored')
  expect(!win.isAlwaysOnTop(), 'Full player remained always-on-top')

  console.log(JSON.stringify({ ok: failures.length === 0, mainWidthBefore, miniWidth, vol, miniVolume, failures, userData }))
  clearTimeout(watchdog)
  if (failures.length) { console.error(`SMOKE FAILED (${failures.length})`); app.exit(1) }
  else { console.log('SMOKE PASSED'); app.exit(0) }
}).catch((error) => {
  clearTimeout(watchdog)
  console.error(error && error.stack ? error.stack : String(error))
  app.exit(1)
})
