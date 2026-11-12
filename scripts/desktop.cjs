/* Single-window native shell around the remote ArtistWave web app. */
const { app, BrowserWindow, screen, shell } = require('electron')
const { join } = require('node:path')
const { pathToFileURL } = require('node:url')

app.setName('ArtistWave')
app.setAppUserModelId('com.alpha.toolbox.audio')

let core
let window
let pollTimer = null
let mini = false
let restore = null // { bounds, maximized }
const status = { mini: false, mode: 'audio', snapshot: null }

const PROBE_SCRIPT = `(() => {
  const body = document.body
  const mini = body.classList.contains('mini-player-active')
  const mode = body.getAttribute('data-mode') || 'audio'
  const host = window.ArtistWaveMiniHost
  if (!host || typeof host.state !== 'function') return { mini, mode, state: null }
  try {
    const s = host.state()
    return { mini, mode, state: s && s.ready === true ? s : null }
  } catch {
    return { mini, mode, state: null }
  }
})()`

function openExternal(url) {
  try {
    if (['https:', 'http:'].includes(new URL(url).protocol)) {
      void shell.openExternal(url).catch((error) => console.error(error.message))
    }
  } catch {
    // Ignore malformed links rather than handing them to the operating system.
  }
}

function enterMini() {
  if (!window || window.isDestroyed() || !restore) return
  if (window.isMaximized()) window.unmaximize()
  const display = screen.getDisplayMatching(window.getBounds())
  const bounds = core.computeMiniBounds(display.workArea, restore.bounds)
  window.setResizable(true)
  window.setMaximizable(false)
  window.setMinimumSize(320, 480)
  window.setBounds(bounds)
  window.setAlwaysOnTop(true)
  window.setTitle('ArtistWave mini')
}

function exitMini() {
  if (!window || window.isDestroyed()) return
  window.setResizable(true)
  window.setMaximizable(true)
  window.setMinimumSize(940, 620)
  window.setAlwaysOnTop(false)
  window.setTitle('ArtistWave')
  if (restore) {
    const { bounds, maximized } = restore
    restore = null
    window.setBounds(bounds)
    if (maximized) window.maximize()
  }
}

async function probe() {
  if (!window || window.isDestroyed() || window.webContents.isDestroyed()) return
  try {
    const raw = await window.webContents.mainFrame.executeJavaScript(PROBE_SCRIPT, false)
    const parsed = core.parseProbe(raw)
    status.mode = parsed.mode
    if (raw && raw.state) status.snapshot = core.normalizeSnapshot(raw.state)
    if (parsed.mini !== mini) {
      mini = parsed.mini
      status.mini = mini
      if (mini) {
        if (!restore) restore = { bounds: window.getBounds(), maximized: window.isMaximized() }
        enterMini()
      } else {
        exitMini()
      }
    }
  } catch {
    // The page can be mid-navigation; the next poll recovers.
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
  module.exports = Promise.resolve(null)
} else {
  app.on('second-instance', () => {
    if (!window || window.isDestroyed()) return
    if (window.isMinimized()) window.restore()
    window.show()
    window.focus()
  })
  app.on('window-all-closed', () => app.quit())
  app.on('before-quit', () => {
    if (pollTimer) clearInterval(pollTimer)
    pollTimer = null
  })

  module.exports = app.whenReady().then(async () => {
    core = await import(pathToFileURL(join(__dirname, '../dist/core.js')).href)

    window = new BrowserWindow({
      width: 1180,
      height: 780,
      minWidth: 940,
      minHeight: 620,
      show: false,
      autoHideMenuBar: true,
      backgroundColor: '#0a0c10',
      title: 'ArtistWave',
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        backgroundThrottling: false,
        autoplayPolicy: 'no-user-gesture-required'
      }
    })

    window.webContents.session.setPermissionRequestHandler((_c, _p, callback) => callback(false))
    window.webContents.session.setPermissionCheckHandler(() => false)

    window.webContents.setWindowOpenHandler(({ url }) => {
      if (core.isArtistWaveMiniUrl(url)) {
        if (!mini) {
          mini = true
          status.mini = true
          if (!restore) restore = { bounds: window.getBounds(), maximized: window.isMaximized() }
          enterMini()
        }
        return { action: 'deny' }
      }
      openExternal(url)
      return { action: 'deny' }
    })

    const origin = new URL(core.APP_PREFIX).origin
    window.webContents.on('will-navigate', (event, url) => {
      try {
        if (new URL(url).origin !== origin) {
          event.preventDefault()
          openExternal(url)
        }
      } catch {
        event.preventDefault()
      }
    })
    window.webContents.on('will-redirect', (event, url) => {
      try {
        if (new URL(url).origin !== origin) event.preventDefault()
      } catch {
        event.preventDefault()
      }
    })
    window.on('page-title-updated', (event) => event.preventDefault())
    window.on('ready-to-show', () => window.show())

    await window.loadURL(core.APP_PREFIX)
    pollTimer = setInterval(() => void probe(), 1000)
    void probe()
    return window
  }).catch((error) => {
    console.error(error)
    app.exit(1)
  })
}