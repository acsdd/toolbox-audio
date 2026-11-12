/* Smoke the packaged ASAR app: boots win-unpacked resources/app.asar main. */
const assert = require('node:assert/strict')
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const unpacked = process.argv[2]
assert.ok(unpacked, 'usage: electron scripts/smoke-portable.cjs <win-unpacked-dir>')
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'artistwave-portable-smoke-'))
app.setPath('userData', userData)
process.env.PORTABLE_EXECUTABLE_DIR = userData
require(path.join(unpacked, 'resources', 'app.asar', 'scripts', 'desktop.cjs'))

const delay = (ms) => new Promise((r) => setTimeout(r, ms))
const watchdog = setTimeout(() => { console.error('portable smoke timed out'); app.exit(1) }, 90000)

app.whenReady().then(async () => {
  const started = Date.now()
  let win
  while (Date.now() - started < 20000) {
    win = BrowserWindow.getAllWindows()[0]
    if (win) break
    await delay(150)
  }
  assert.ok(win, 'no window from packaged app')
  if (win.webContents.isLoading()) {
    await new Promise((r) => win.webContents.once('did-finish-load', r))
  }
  await delay(1500)
  const prefs = win.webContents.getLastWebPreferences()
  assert.equal(prefs.sandbox, true)
  assert.equal(prefs.contextIsolation, true)
  assert.equal(prefs.nodeIntegration, false)
  const url = await win.webContents.mainFrame.executeJavaScript(`location.href`, false)
  assert.ok(url.startsWith('https://28121978444.github.io/ArtistWave/'), `bad url ${url}`)
  console.log(JSON.stringify({ ok: true, url }))
  clearTimeout(watchdog)
  app.exit(0)
}).catch((e) => { clearTimeout(watchdog); console.error(e); app.exit(1) })