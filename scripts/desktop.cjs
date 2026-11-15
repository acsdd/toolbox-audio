/* AudioWave desktop host for the ArtistWave music app and first-party widgets. */
const { app, BrowserWindow, Menu, ipcMain, screen, shell, net, session, safeStorage } = require('electron')
const fs = require('node:fs')
const { join } = require('node:path')
const { pathToFileURL } = require('node:url')
const { signIn } = require('./google-auth.cjs')
const { createNavidrome } = require('./navidrome.cjs')
const { createPlex } = require('./plex.cjs')

const APP_NAME = 'AudioWave'
const MINI_PLAYER_ID = 'mini-player'
const WIDGET_CATALOG = [
  {
    id: MINI_PLAYER_ID,
    name: 'Mini Player',
    description: 'A compact, always-on-top player connected to the main ArtistWave session.',
    publisher: 'AudioWave',
    version: '1.0.0',
    firstParty: true
  }
]

app.setName(APP_NAME)
app.setAppUserModelId('com.alpha.audiowave')

let core
let mainWindow
let managerWindow
let authAttempt
let navidrome
let plex

for (const operation of ['status', 'connect', 'disconnect', 'albums', 'tracks']) {
  ipcMain.handle('audiowave:navidrome:' + operation, (event, input) => {
    requireAuthPage(event)
    if (!navidrome) throw new Error('Music server connection is not ready.')
    return navidrome[operation](input)
  })
}

for (const operation of ['status', 'connect', 'cancel', 'disconnect', 'albums', 'tracks']) {
  ipcMain.handle('audiowave:plex:' + operation, (event, input) => {
    requireAuthPage(event)
    if (!plex) throw new Error('Plex connection is not ready.')
    return plex[operation](input)
  })
}

function requireAuthPage(event) {
  if (!mainWindow || mainWindow.isDestroyed() ||
      event.sender !== mainWindow.webContents ||
      event.senderFrame !== mainWindow.webContents.mainFrame ||
      !event.senderFrame.url.startsWith('https://acsdd.github.io/ArtistWave/')) {
    throw new Error('Sign-in is only available from the AudioWave player.')
  }
}

ipcMain.handle('audiowave:auth:sign-in', async (event) => {
  requireAuthPage(event)
  if (authAttempt) throw new Error('A sign-in is already open in your browser.')
  const attempt = new AbortController()
  authAttempt = attempt
  try {
    const token = await signIn({ openExternal: url => shell.openExternal(url), signal: attempt.signal })
    if (!mainWindow.isDestroyed()) {
      mainWindow.show()
      mainWindow.focus()
    }
    return token
  } finally {
    if (authAttempt === attempt) authAttempt = null
  }
})
ipcMain.handle('audiowave:auth:cancel', event => {
  requireAuthPage(event)
  authAttempt?.abort()
})
let installedWidgets = new Set()
const widgetSettingsPath = join(app.getPath('userData'), 'widgets.json')

function loadInstalledWidgets() {
  try {
    const saved = JSON.parse(fs.readFileSync(widgetSettingsPath, 'utf8'))
    if (saved.schemaVersion !== 1 || !Array.isArray(saved.installed)) return new Set()
    return new Set(saved.installed.filter((id) => WIDGET_CATALOG.some((widget) => widget.id === id)))
  } catch {
    return new Set()
  }
}

function saveInstalledWidgets() {
  fs.mkdirSync(app.getPath('userData'), { recursive: true })
  const tempPath = `${widgetSettingsPath}.tmp`
  fs.writeFileSync(tempPath, JSON.stringify({ schemaVersion: 1, installed: [...installedWidgets] }, null, 2), {
    encoding: 'utf8',
    mode: 0o600
  })
  fs.renameSync(tempPath, widgetSettingsPath)
}

function widgetList() {
  return WIDGET_CATALOG.map((widget) => ({
    ...widget,
    installed: installedWidgets.has(widget.id)
  }))
}

function openExternal(url) {
  try {
    if (['https:', 'http:'].includes(new URL(url).protocol)) {
      void shell.openExternal(url).catch((error) => console.error(error.message))
    }
  } catch {
    // Ignore malformed links rather than handing them to the operating system.
  }
}

function openMiniPlayerWidget() {
  if (!installedWidgets.has(MINI_PLAYER_ID) || !mainWindow || mainWindow.isDestroyed()) return false
  if (mainWindow.webContents.isLoading()) {
    mainWindow.webContents.once('did-finish-load', openMiniPlayerWidget)
    return true
  }
  void mainWindow.webContents.executeJavaScript('window.ArtistWaveMiniHost?.open()').catch(() => {})
  return true
}

function openWidgetManager() {
  if (managerWindow && !managerWindow.isDestroyed()) {
    managerWindow.show()
    managerWindow.focus()
    return
  }

  managerWindow = new BrowserWindow({
    width: 620,
    height: 500,
    minWidth: 500,
    minHeight: 400,
    parent: mainWindow,
    title: 'AudioWave Widgets',
    autoHideMenuBar: true,
    backgroundColor: '#0b1015',
    webPreferences: {
      preload: join(__dirname, 'widget-manager-preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  managerWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  const managerUrl = pathToFileURL(join(__dirname, 'widgets.html')).href
  managerWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== managerUrl) event.preventDefault()
  })
  managerWindow.on('closed', () => { managerWindow = null })
  void managerWindow.loadFile(join(__dirname, 'widgets.html'))
}

function rebuildApplicationMenu() {
  const miniInstalled = installedWidgets.has(MINI_PLAYER_ID)
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: APP_NAME,
      submenu: [
        { role: 'about' },
        { label: 'Cancel Google sign-in', click: () => authAttempt?.abort() },
        { type: 'separator' },
        { role: 'quit', label: 'Quit AudioWave' }
      ]
    },
    {
      label: 'Widgets',
      submenu: [
        {
          label: 'Manage Widgets…',
          accelerator: 'Ctrl+Shift+W',
          click: openWidgetManager
        },
        { type: 'separator' },
        { label: `Mini Player — ${miniInstalled ? 'Installed' : 'Not installed'}`, enabled: false },
        {
          label: 'Open Mini Player',
          enabled: miniInstalled,
          click: openMiniPlayerWidget
        }
      ]
    }
  ]))
}

function requireWidgetManager(event) {
  if (!managerWindow || managerWindow.isDestroyed() || event.sender !== managerWindow.webContents) {
    throw new Error('Widget actions are only available from the AudioWave widget manager.')
  }
}

ipcMain.handle('audiowave:widgets:list', (event) => {
  requireWidgetManager(event)
  return widgetList()
})

ipcMain.handle('audiowave:widgets:install', (event, id) => {
  requireWidgetManager(event)
  if (typeof id !== 'string' || !WIDGET_CATALOG.some((widget) => widget.id === id)) {
    throw new Error('This widget is not in the AudioWave first-party catalog.')
  }
  installedWidgets.add(id)
  saveInstalledWidgets()
  rebuildApplicationMenu()
  return widgetList()
})

ipcMain.handle('audiowave:widgets:uninstall', (event, id) => {
  requireWidgetManager(event)
  if (typeof id !== 'string' || !WIDGET_CATALOG.some((widget) => widget.id === id)) {
    throw new Error('This widget is not in the AudioWave first-party catalog.')
  }
  installedWidgets.delete(id)
  if (id === MINI_PLAYER_ID && mainWindow && !mainWindow.isDestroyed()) {
    void mainWindow.webContents.executeJavaScript('window.ArtistWaveMiniHost?.closeFallback()').catch(() => {})
  }
  saveInstalledWidgets()
  rebuildApplicationMenu()
  return widgetList()
})

ipcMain.handle('audiowave:widgets:open', (event, id) => {
  requireWidgetManager(event)
  if (id !== MINI_PLAYER_ID || !installedWidgets.has(id)) {
    throw new Error('Install the Mini Player before opening it.')
  }
  return openMiniPlayerWidget()
})

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  })
  app.on('window-all-closed', () => app.quit())

  module.exports = app.whenReady().then(async () => {
    core = await import(pathToFileURL(join(__dirname, '../dist/core.js')).href)
    // Preserve the existing HTTPS origin and its saved library while serving
    // the interface shipped in this package. API/media requests use the network.
    const assets = join(__dirname, '../artistwave')
    navidrome = createNavidrome({
      file: join(app.getPath('userData'), 'navidrome.bin'),
      secureStorage: safeStorage
    })
    plex = createPlex({
      file: join(app.getPath('userData'), 'plex.bin'), secureStorage: safeStorage,
      openExternal: url => shell.openExternal(url)
    })
    if (!fs.existsSync(join(assets, 'index.html'))) throw new Error('Bundled ArtistWave files are missing.')
    await session.defaultSession.clearStorageData({ storages: ['serviceworkers', 'cachestorage'] })
    session.defaultSession.protocol.handle('https', request => {
      const url = new URL(request.url)
      if (url.origin === 'https://acsdd.github.io' && url.pathname.startsWith('/ArtistWave/__plex/')) {
        return plex.media(request)
      }
      if (url.origin === 'https://acsdd.github.io' && url.pathname.startsWith('/ArtistWave/__navidrome/')) {
        return navidrome.media(request)
      }
      if (url.origin === 'https://acsdd.github.io' && url.pathname.startsWith('/ArtistWave/')) {
        const filename = url.pathname.slice('/ArtistWave/'.length) || 'index.html'
        if (!/^[a-zA-Z0-9_-]+\.(html|js|css|png|webmanifest)$/.test(filename)) {
          return new Response('Not found', { status: 404 })
        }
        const file = join(assets, filename)
        if (!fs.existsSync(file)) return new Response('Not found', { status: 404 })
        return net.fetch(pathToFileURL(file).href)
      }
      return net.fetch(request, { bypassCustomProtocolHandlers: true })
    })
    installedWidgets = loadInstalledWidgets()
    rebuildApplicationMenu()

    mainWindow = new BrowserWindow({
      width: 1180,
      height: 780,
      minWidth: 940,
      minHeight: 620,
      show: false,
      autoHideMenuBar: false,
      backgroundColor: '#0a0c10',
      title: APP_NAME,
      webPreferences: {
        preload: join(__dirname, 'auth-preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        backgroundThrottling: false,
        autoplayPolicy: 'no-user-gesture-required'
      }
    })

    mainWindow.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
    mainWindow.webContents.session.setPermissionCheckHandler(() => false)
    mainWindow.webContents.on('did-start-navigation', (_event, _url, inPlace, isMainFrame) => {
      if (isMainFrame && !inPlace) { authAttempt?.abort(); plex?.cancel() }
    })
    mainWindow.once('closed', () => { authAttempt?.abort(); plex?.cancel() })

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (!core.isArtistWaveMiniUrl(url)) openExternal(url)
      return { action: 'deny' }
    })

    const origin = new URL(core.APP_PREFIX).origin
    mainWindow.webContents.on('will-navigate', (event, url) => {
      try {
        if (new URL(url).origin !== origin) {
          event.preventDefault()
          openExternal(url)
        }
      } catch {
        event.preventDefault()
      }
    })
    mainWindow.webContents.on('will-redirect', (event, url) => {
      try {
        if (new URL(url).origin !== origin) event.preventDefault()
      } catch {
        event.preventDefault()
      }
    })
    mainWindow.on('page-title-updated', (event) => event.preventDefault())
    mainWindow.on('ready-to-show', () => mainWindow.show())

    let fullBounds = null
    let probing = false
    let wasMaximized = false
    const resizeTimer = setInterval(async () => {
      if (probing || !mainWindow || mainWindow.isDestroyed()) return
      probing = true
      try {
        const { mini, pin } = await mainWindow.webContents.executeJavaScript(`(() => {
          const mini = document.body.classList.contains('mini-player-active')
          const settings = document.body.dataset
          if (mini) settings.miniAlwaysOnTop ??= 'true'
          else delete settings.miniAlwaysOnTop
          return { mini, pin: settings.miniAlwaysOnTop === 'true' }
        })()`)
        if (mini && !fullBounds) {
          wasMaximized = mainWindow.isMaximized()
          fullBounds = mainWindow.getNormalBounds()
          const { workArea } = screen.getDisplayMatching(mainWindow.getBounds())
          if (wasMaximized) mainWindow.unmaximize()
          mainWindow.setMinimumSize(320, 460)
          mainWindow.setBounds(core.computeMiniBounds(workArea, fullBounds))
        } else if (!mini && fullBounds) {
          mainWindow.setAlwaysOnTop(false)
          mainWindow.setBounds(fullBounds)
          mainWindow.setMinimumSize(940, 620)
          if (wasMaximized) mainWindow.maximize()
          fullBounds = null
        }
        if (mini && mainWindow.isAlwaysOnTop() !== pin) mainWindow.setAlwaysOnTop(pin)
      } catch {} finally { probing = false }
    }, 200)
    mainWindow.once('closed', () => clearInterval(resizeTimer))

    await mainWindow.loadURL(core.APP_PREFIX)
    return mainWindow
  }).catch((error) => {
    console.error(error)
    app.exit(1)
  })
}
