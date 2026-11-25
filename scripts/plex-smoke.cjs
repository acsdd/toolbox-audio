const { app, shell } = require('electron')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const http = require('node:http')

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'audiowave-plex-smoke-'))
app.setPath('userData', userData)
fs.writeFileSync(path.join(userData, 'widgets.json'), JSON.stringify({ schemaVersion: 1, installed: ['mini-player'] }))
const wav = Buffer.alloc(44 + 44100 * 2 * 10)
wav.write('RIFF');wav.writeUInt32LE(wav.length - 8, 4);wav.write('WAVEfmt ', 8)
wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22)
wav.writeUInt32LE(44100,24);wav.writeUInt32LE(88200,28)
wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(wav.length - 44,40)
let browserOpened = false, streamRequests = 0
const originalFetch = global.fetch
global.fetch = async (address, options) => {
  const url = new URL(address instanceof Request ? address.url : address)
  if (url.origin === 'https://plex.tv') {
    if (url.pathname === '/api/v2/pins') return Response.json({ id: 1, code: 'fixture-pin' })
    return Response.json({ authToken: 'fixture-account-token' })
  }
  if (url.origin === 'https://clients.plex.tv') {
    return Response.json([{ clientIdentifier: 'fixture-server', provides: 'server', accessToken: 'fixture-server-token' }])
  }
  return originalFetch(address, options)
}
shell.openExternal = async address => {
  assert.equal(new URL(address).origin, 'https://app.plex.tv')
  browserOpened = true
}
const server = http.createServer((req,res) => {
  const url = new URL(req.url, 'http://localhost')
  res.setHeader('Content-Type','application/json')
  if (url.pathname === '/identity') return res.end(JSON.stringify({ MediaContainer: { machineIdentifier: 'fixture-server' } }))
  if (req.headers['x-plex-token'] !== 'fixture-server-token') return res.writeHead(401).end()
  if (url.pathname.startsWith('/library/parts/')) {
    streamRequests++
    res.setHeader('Content-Type','audio/wav');res.setHeader('Accept-Ranges','bytes')
    const range = req.headers.range?.match(/^bytes=(\d+)-(\d*)$/)
    const start = range ? Number(range[1]) : 0
    const end = range && range[2] ? Math.min(Number(range[2]), wav.length - 1) : wav.length - 1
    if (start >= wav.length) return res.writeHead(416).end()
    if (range) { res.statusCode=206;res.setHeader('Content-Range',`bytes ${start}-${end}/${wav.length}`) }
    res.setHeader('Content-Length',end-start+1)
    return res.end(wav.subarray(start,end+1))
  }
  let data
  if (url.pathname === '/library/sections') data = {
    Directory: [{ key: '1', type: 'movie', title: 'Movies' }, { key: '2', type: 'artist', title: 'Music' }]
  }
  else if (url.pathname.endsWith('/all')) data = {
    totalSize: 1, Metadata: [{ ratingKey: '10', type: 'album', title: 'Plex test album', parentTitle: 'Plex test artist' }]
  }
  else data = { Metadata: [{
    ratingKey: '11', type: 'track', title: 'Plex test track', grandparentTitle: 'Plex test artist', parentTitle: 'Plex test album',
    Media: [{ Part: [{ key: '/library/parts/12/1/file.wav' }] }]
  }] }
  res.end(JSON.stringify({ MediaContainer: data }))
})
const delay = ms => new Promise(resolve=>setTimeout(resolve,ms))
const watchdog = setTimeout(()=>{console.error('Plex smoke timed out');app.exit(1)},60000)
async function waitFor(win, script) {
  for(let attempt=0;attempt<80;attempt++){
    if(await win.webContents.executeJavaScript(script))return
    await delay(150)
  }
  throw new Error('Timed out waiting for '+script)
}
server.listen(0,'127.0.0.1',async()=>{
  try{
    const main = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname,'desktop.cjs')
    const win = await require(main)
    await waitFor(win,"typeof window.AudioWavePlex === 'object'")
    await win.webContents.executeJavaScript("document.getElementById('plexOpen').click()")
    await waitFor(win,"document.querySelector('.navidrome-dialog').open && !document.getElementById('navidromeConnectButton').disabled")
    await win.webContents.executeJavaScript(`(() => {
      document.getElementById('navidromeUrl').value='http://127.0.0.1:${server.address().port}/web/index.html#!/';
      document.getElementById('navidromeConnect').requestSubmit();
    })()`)
    await waitFor(win,"document.querySelectorAll('.navidrome-album').length === 1 && !document.querySelector('.navidrome-album').disabled")
    assert(browserOpened)
    const libraries = await win.webContents.executeJavaScript("[...document.getElementById('navidromeSection').options].map(option=>option.textContent)")
    assert.deepEqual(libraries,['Music'])
    await win.webContents.executeJavaScript("document.querySelector('.navidrome-album').click()")
    await waitFor(win,"document.querySelectorAll('.navidrome-track').length === 1 && !document.getElementById('navidromePlayAlbum').disabled")
    if(process.env.PLEX_SMOKE_SCREENSHOT) fs.writeFileSync(process.env.PLEX_SMOKE_SCREENSHOT,(await win.webContents.capturePage()).toPNG())
    await win.webContents.executeJavaScript("document.getElementById('navidromePlayAlbum').click()")
    await waitFor(win,"document.getElementById('audio').readyState >= 2")
    assert(streamRequests>0)
    const track = await win.webContents.executeJavaScript("window.ArtistWaveLibrary.getCurrent()")
    assert.equal(track.source,'PLEX')
    assert(!track.url.includes('fixture-server-token'))
    assert(!fs.readFileSync(path.join(userData,'plex.bin')).includes(Buffer.from('fixture-server-token')))
    await win.webContents.executeJavaScript("document.getElementById('audio').currentTime=5")
    await waitFor(win,"document.getElementById('audio').currentTime >= 5")
    await win.webContents.executeJavaScript("document.getElementById('openMiniPlayer').click()")
    await delay(800)
    assert.equal(win.getBounds().width,430)
    const title = await win.webContents.executeJavaScript("document.getElementById('miniPlayerFallbackFrame').contentDocument.getElementById('miniTitle').textContent")
    assert.equal(title,'Plex test track')
    await win.webContents.executeJavaScript("window.AudioWavePlex.disconnect()")
    assert(!fs.existsSync(path.join(userData,'plex.bin')))
    console.log('PLEX SMOKE PASSED: browser authorization, library selection, playback, seeking, encrypted storage, Mini and disconnect')
    clearTimeout(watchdog);server.close();app.exit(0)
  }catch(error){console.error(error);clearTimeout(watchdog);server.close();app.exit(1)}
})
