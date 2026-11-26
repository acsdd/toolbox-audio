/* End-to-end smoke for the AudioWave shell and first-party Mini Player widget. */
const assert = require('node:assert/strict')
const { app, BrowserWindow, screen } = require('electron')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'audiowave-smoke-'))
app.setPath('userData', userData)
fs.writeFileSync(path.join(userData, 'widgets.json'), JSON.stringify({ schemaVersion: 1, installed: ['mini-player','youtube-player'] }))
const appMain = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, 'desktop.cjs')
require(appMain)

const APP_PREFIX = 'https://acsdd.github.io/ArtistWave/'
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
async function waitForPin(win, expected, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline && win.isAlwaysOnTop() !== expected) await delay(100)
}

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
  const widgetMenu = require('electron').Menu.getApplicationMenu().items.find(item=>item.label==='Widgets')?.submenu
  expect(widgetMenu?.items.some(item=>item.label==='Open YouTube Player' && item.enabled), 'Installed YouTube widget is missing from the menu')
  widgetMenu.items.find(item=>item.label==='Manage Widgets…').click()
  const manager=await waitForWindow(item=>item.getTitle()==='AudioWave Widgets','widget manager')
  await delay(400)
  const removeYouTube=await manager.webContents.executeJavaScript(`(()=>{const card=[...document.querySelectorAll('.widget-card')].find(x=>x.querySelector('h2')?.textContent==='YouTube Player');const button=[...card?.querySelectorAll('button')||[]].find(x=>x.textContent==='Remove');button?.click();return !!button})()`)
  expect(removeYouTube,'YouTube widget is missing from the manager')
  await delay(400)
  const reinstallYouTube=await manager.webContents.executeJavaScript(`(()=>{const card=[...document.querySelectorAll('.widget-card')].find(x=>x.querySelector('h2')?.textContent==='YouTube Player');const button=[...card?.querySelectorAll('button')||[]].find(x=>x.textContent==='Install');button?.click();return !!button})()`)
  expect(reinstallYouTube,'YouTube widget could not be removed or reinstalled')
  await delay(400)
  manager.close()
  const fullWorkArea = screen.getDisplayMatching(win.getBounds()).workArea
  expect(win.getBounds().height === fullWorkArea.height && win.getBounds().y === fullWorkArea.y, 'Full player does not fill screen work area height')
  const themes = await frame(win).executeJavaScript(`(() => {
    const select=document.getElementById('themeSelect');
    const choices=[...select.options].map(option=>option.value);
    select.value='bugs';select.dispatchEvent(new Event('change'));
    return {choices,selected:document.documentElement.dataset.theme};
  })()`)
  expect(['night','day','bright-night','ocean','plum','bugs','daffy','tweety','sylvester','taz','roadrunner'].every(theme=>themes.choices.includes(theme)), 'Theme choices missing')
  expect(themes.selected === 'bugs', 'Theme selection failed')

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
  expect(miniWidth === 430, `Mini mode width is ${miniWidth}`)
  expect(win.getBounds().x + miniWidth === workArea.x + workArea.width, 'Mini mode is not aligned to the right edge of the work area')
  expect(win.getBounds().height === workArea.height, 'Mini mode does not fill the work area height')
  expect(win.getBounds().y === workArea.y, 'Mini mode does not start at the top of the work area')
  await waitForPin(win,true)
  expect(win.isAlwaysOnTop(), 'Mini mode is not always-on-top')
  expect(BrowserWindow.getAllWindows().length === 1, 'Mini mode opened another window')
  const active = await frame(win).executeJavaScript("document.body.classList.contains('mini-player-active')", false)
  expect(active, 'embedded mini mode is not active')
  const miniControls = await frame(win).executeJavaScript(`(() => {
    const doc = document.getElementById('miniPlayerFallbackFrame').contentDocument
    const pin = doc.getElementById('miniAlwaysOnTop')
    const playlists = doc.getElementById('miniPlaylists')
    const theme = doc.querySelector('.theme-select-label'); const close = doc.querySelector('.mini-close'); const header = doc.querySelector('.mini-top'); const t = theme.getBoundingClientRect(), c = close.getBoundingClientRect(), h = header.getBoundingClientRect();
    return { pinVisible: !pin.hidden, playlistSelector: playlists.tagName === 'SELECT', themeFits: t.left >= h.left && t.right <= c.left && c.right <= h.right }
  })()`)
  expect(miniControls.themeFits, 'Mini theme selector overlaps or extends outside the header')
  expect(miniControls.pinVisible, 'Always-on-top button is hidden')
  expect(miniControls.playlistSelector, 'Playlist selector is missing')
  const miniTheme = await frame(win).executeJavaScript("document.getElementById('miniPlayerFallbackFrame').contentDocument.documentElement.dataset.theme")
  expect(miniTheme === 'bugs', 'Mini player did not inherit selected theme')
  await frame(win).executeJavaScript("document.getElementById('miniPlayerFallbackFrame').contentDocument.getElementById('miniAlwaysOnTop').click()")
  await delay(700)
  await waitForPin(win,false)
  expect(!win.isAlwaysOnTop(), 'Always-on-top button did not turn pinning off')
  await frame(win).executeJavaScript("document.getElementById('miniPlayerFallbackFrame').contentDocument.getElementById('miniAlwaysOnTop').click()")
  await delay(700)
  await waitForPin(win,true)
  expect(win.isAlwaysOnTop(), 'Always-on-top button did not turn pinning on')
  const miniVolume = await frame(win).executeJavaScript(`window.ArtistWaveMiniHost.state().volume`, false)
  await frame(win).executeJavaScript('window.ArtistWaveMiniHost.closeFallback()', false)
  await delay(900)
  expect(win.getBounds().width === mainWidthBefore, 'Full player width was not restored')
  expect(win.getBounds().x === mainXBefore, 'Full player horizontal position was not restored')
  expect(!win.isAlwaysOnTop(), 'Full player remained always-on-top')

  const missingSearchKey = await frame(win).executeJavaScript(`(() => {
    localStorage.removeItem('artistwave.youtubeDataApiKey');document.getElementById('youtubeApiKey').value='';
    document.getElementById('artistInput').value='Test band';document.getElementById('searchForm').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    return {visible:!document.getElementById('youtubeDiscover').hidden,setup:!document.getElementById('youtubeDiscoverSetup').hidden};
  })()`)
  expect(missingSearchKey.visible && missingSearchKey.setup, 'YouTube search setup was not offered when the key is missing')
  await frame(win).executeJavaScript(`(() => {
    localStorage.setItem('artistwave.youtubeDataApiKey','synthetic-key');
    window.__realFetch=window.fetch;window.__ytQuery=null;
    window.fetch=(input,options)=>{const url=String(input);if(url.startsWith('https://www.googleapis.com/youtube/v3/search?')){window.__ytQuery=new URL(url).searchParams.get('videoEmbeddable');return Promise.resolve({ok:true,json:async()=>({items:[{id:{videoId:'aqz-KE-bpKQ'},snippet:{title:'Test video',channelTitle:'Test channel',thumbnails:{medium:{url:'https://i.ytimg.com/vi/aqz-KE-bpKQ/mqdefault.jpg'}}}}]})})}return window.__realFetch(input,options)};
    document.getElementById('searchForm').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
  })()`)
  await delay(300)
  const youtubeSearch = await frame(win).executeJavaScript(`(() => {
    const panel=document.getElementById('youtubeDiscover'),result=document.querySelector('#youtubeDiscoverResults button');result?.click();
    const src=document.getElementById('youtubeFrame').getAttribute('src');return {visible:!panel.hidden,result:!!result,filter:window.__ytQuery,src,widget:document.body.classList.contains('youtube-widget-open')};
  })()`)
  expect(youtubeSearch.visible && youtubeSearch.result && youtubeSearch.filter==='true' && youtubeSearch.widget && youtubeSearch.src?.includes('/embed/aqz-KE-bpKQ') && new URL(youtubeSearch.src).searchParams.get('autoplay')==='1', 'Entertainment search did not open the selected YouTube result')
  await frame(win).executeJavaScript(`(()=>{window.ArtistWaveYouTubeWidget.close();window.fetch=window.__realFetch;localStorage.removeItem('artistwave.youtubeDataApiKey');document.getElementById('sourceMode').value='local';document.getElementById('sourceMode').dispatchEvent(new Event('change'));})()`)
  expect(await frame(win).executeJavaScript("document.getElementById('youtubeDiscover').hidden"), 'Local-only mode did not hide YouTube search')
  await frame(win).executeJavaScript("document.getElementById('sourceMode').value='both'")

  const youtubeFull = await frame(win).executeJavaScript(`(() => {
    window.__ytCalls=[];window.YT={Player:class {constructor(frame,options){this.state=2;setTimeout(()=>options.events.onReady(),0)} getPlayerState(){return this.state} getDuration(){return 100} getCurrentTime(){return 10} playVideo(){this.state=1;window.__ytCalls.push('play')} pauseVideo(){this.state=2;window.__ytCalls.push('pause')} seekTo(value){window.__ytCalls.push(['seek',value])} setVolume(value){window.__ytCalls.push(['volume',value])}}};
    window.ArtistWaveYouTubeWidget.open();
    const input=document.getElementById('youtubeUrl');input.value='https://www.youtube.com/watch?v=aqz-KE-bpKQ';
    document.getElementById('youtubeLinkForm').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    const region=document.getElementById('youtubePlayerRegion');const rect=region.getBoundingClientRect();
    return {visible:!region.hidden,width:rect.width,height:rect.height,button:!document.getElementById('youtubeMiniPlayer').disabled,mode:document.body.dataset.mode,tab:!!document.getElementById('modeYoutube')};
  })()`)
  expect(youtubeFull.visible && youtubeFull.width >= 200 && youtubeFull.height >= 200 && youtubeFull.button && youtubeFull.mode==='audio' && !youtubeFull.tab, 'Entertainment YouTube widget or Mini launcher is unavailable')
  await delay(100)
  const youtubeControls = await frame(win).executeJavaScript(`(() => {const region=document.getElementById('youtubePlayerRegion'),play=region.querySelector('[data-yt=toggle]'),seek=region.querySelector('[data-yt=seek]'),volume=region.querySelector('[data-yt=volume]');play.click();seek.value='500';seek.dispatchEvent(new Event('input'));volume.value='40';volume.dispatchEvent(new Event('input'));return window.__ytCalls})()`)
  expect(youtubeControls.some(x=>x==='play') && youtubeControls.some(x=>Array.isArray(x)&&x[0]==='seek'&&x[1]===50) && youtubeControls.some(x=>Array.isArray(x)&&x[0]==='volume'&&x[1]===40), 'YouTube controls did not call the player API')
  const mainYouTubeControls = await frame(win).executeJavaScript(`(() => {document.getElementById('playButton').click();const seek=document.getElementById('seekBar');seek.value='250';seek.dispatchEvent(new Event('input',{bubbles:true}));return {calls:window.__ytCalls,source:document.getElementById('playingSource').textContent}})()`)
  expect(mainYouTubeControls.source==='YOUTUBE' && mainYouTubeControls.calls.includes('pause') && mainYouTubeControls.calls.some(x=>Array.isArray(x)&&x[0]==='seek'&&x[1]===25), 'Main AudioWave controls did not operate YouTube')
  await frame(win).executeJavaScript("document.getElementById('youtubeMiniPlayer').click()")
  await delay(1000)
  const youtubeMini = await frame(win).executeJavaScript(`(() => {
    const main=document.getElementById('youtubeFrame');const doc=document.getElementById('miniPlayerFallbackFrame').contentDocument;
    const video=doc.getElementById('miniYoutubeFrame'),rect=video.getBoundingClientRect();
    return {mainStopped:!main.getAttribute('src'),miniVisible:!doc.getElementById('miniYoutube').hidden,src:video.getAttribute('src'),width:rect.width,height:rect.height,audioControlsHidden:getComputedStyle(doc.querySelector('.mini-controls')).display==='none'};
  })()`)
  expect(youtubeMini.mainStopped && youtubeMini.miniVisible && youtubeMini.src?.includes('/embed/aqz-KE-bpKQ') && youtubeMini.width >= 200 && youtubeMini.height >= 200 && youtubeMini.audioControlsHidden, 'YouTube Mini handoff or layout failed')
  expect(new URL(youtubeMini.src).searchParams.get('start')==='10', 'YouTube handoff did not preserve the current position')
  await frame(win).executeJavaScript("document.getElementById('miniPlayerFallbackFrame').contentDocument.getElementById('miniOpenMain').click()")
  await delay(900)
  const youtubeReturn = await frame(win).executeJavaScript(`({src:document.getElementById('youtubeFrame').getAttribute('src'),miniHidden:document.getElementById('miniPlayerFallback').hidden})`)
  expect(youtubeReturn.miniHidden && youtubeReturn.src?.includes('/embed/aqz-KE-bpKQ'), 'YouTube video did not return to the full player')
  await frame(win).executeJavaScript("window.ArtistWaveYouTubeWidget.close()")

  console.log(JSON.stringify({ ok: failures.length === 0, mainWidthBefore, miniWidth, vol, miniVolume, failures, userData }))
  clearTimeout(watchdog)
  if (failures.length) { console.error(`SMOKE FAILED (${failures.length})`); app.exit(1) }
  else { console.log('SMOKE PASSED'); app.exit(0) }
}).catch((error) => {
  clearTimeout(watchdog)
  console.error(error && error.stack ? error.stack : String(error))
  app.exit(1)
})
