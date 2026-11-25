const { app } = require('electron')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const http = require('node:http')
const { createHash } = require('node:crypto')

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'audiowave-navidrome-smoke-'))
app.setPath('userData', userData)
fs.writeFileSync(path.join(userData, 'widgets.json'), JSON.stringify({ schemaVersion: 1, installed: ['mini-player'] }))
const wav = Buffer.alloc(44 + 44100 * 2 * 10)
wav.write('RIFF');wav.writeUInt32LE(wav.length - 8, 4);wav.write('WAVEfmt ', 8)
wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22)
wav.writeUInt32LE(44100,24);wav.writeUInt32LE(88200,28)
wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(wav.length - 44,40)
let streamRequests = 0
const server = http.createServer((req,res) => {
  const url = new URL(req.url, 'http://localhost')
  const valid = url.searchParams.get('u') === 'fixture-user' &&
    url.searchParams.get('t') === createHash('md5').update('fixture-password' + url.searchParams.get('s')).digest('hex')
  res.setHeader('Content-Type', 'application/json')
  if (!valid) return res.end(JSON.stringify({ 'subsonic-response': { status:'failed', error:{ code:40 } } }))
  if (url.pathname === '/rest/stream.view') {
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
  const data = { status:'ok', version:'1.16.1' }
  if (url.pathname === '/rest/getAlbumList2.view' || url.pathname === '/rest/search3.view') {
    const indexing=Boolean(process.env.MUSIC_INDEX_SMOKE)
    const offset=Number(url.searchParams.get('offset')||0)
    data[url.pathname.includes('search3') ? 'searchResult3' : 'albumList2'] = {
      album:!indexing?[{id:'album-1',name:'Test album',artist:'Test artist',songCount:1}]:offset===0?
        Array.from({length:40},(_,i)=>({id:'album-'+i,name:'Test album '+i,artist:'Test artist',songCount:1})):
        offset===40?[{id:'album-40',name:'Hidden beyond first page',artist:'Test artist',songCount:1}]:[]
    }
  }
  if (url.pathname === '/rest/getAlbum.view') data.album = {
    song:[{id:'song-1',title:'Test track',artist:'Test artist',album:'Test album'}]
  }
  res.end(JSON.stringify({ 'subsonic-response':data }))
})
const delay = ms => new Promise(resolve=>setTimeout(resolve,ms))
const watchdog = setTimeout(()=>{console.error('Navidrome smoke timed out');app.exit(1)},45000)
async function waitFor(win, script) {
  for(let attempt=0;attempt<60;attempt++){
    if(await win.webContents.executeJavaScript(script))return
    await delay(150)
  }
  throw new Error('Timed out waiting for '+script)
}
server.listen(0,'127.0.0.1',async()=>{
  try{
    const main = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname,'desktop.cjs')
    const win = await require(main)
    await waitFor(win,"typeof window.AudioWaveNavidrome === 'object'")
    await win.webContents.executeJavaScript(`document.getElementById('navidromeOpen').click()`)
    await waitFor(win,"document.querySelector('.navidrome-dialog').open && !document.querySelector('#navidromeConnect button').disabled")
    await win.webContents.executeJavaScript(`(() => {
      document.getElementById('navidromeUrl').value='http://127.0.0.1:${server.address().port}';
      document.getElementById('navidromeUser').value='fixture-user';
      document.getElementById('navidromePassword').value='fixture-password';
      document.getElementById('navidromeConnect').requestSubmit();
    })()`)
    await waitFor(win,"document.querySelectorAll('.navidrome-album').length > 0 && !document.querySelector('.navidrome-album').disabled")
    await win.webContents.executeJavaScript("document.querySelector('.navidrome-dialog').close();document.getElementById('myMusicOpen').click()")
    await waitFor(win,"document.querySelectorAll('.music-album').length > 0 && !document.getElementById('musicRefresh').disabled")
    if(process.env.MUSIC_INDEX_SMOKE){
      await waitFor(win,"document.getElementById('musicStatus').textContent.includes('41 albums indexed') && document.getElementById('musicCancelScan').hidden")
      await win.webContents.executeJavaScript("document.getElementById('musicSearch').value='Hidden beyond';document.getElementById('musicSearch').dispatchEvent(new Event('input'))")
      assert.equal(await win.webContents.executeJavaScript("document.querySelectorAll('.music-album').length"),1)
      await win.webContents.executeJavaScript("document.getElementById('musicSearch').value='';document.getElementById('musicSearch').dispatchEvent(new Event('input'))")
    }
    await win.webContents.executeJavaScript("document.getElementById('musicSort').value='artist';document.getElementById('musicSort').dispatchEvent(new Event('change'));document.querySelector('#musicAlbums button').click()")
    await waitFor(win,"document.querySelectorAll('.music-album').length > 0")
    await win.webContents.executeJavaScript("document.querySelector('.music-album-open').click()")
    await waitFor(win,"document.querySelectorAll('.music-track').length === 1")
    if(process.env.MUSIC_SMOKE_SCREENSHOT){
      if(process.env.MUSIC_SMOKE_DAY)await win.webContents.executeJavaScript("window.ArtistWaveTheme.applyTheme('day')")
      fs.writeFileSync(process.env.MUSIC_SMOKE_SCREENSHOT,(await win.webContents.capturePage()).toPNG())
    }
    await win.webContents.executeJavaScript("document.getElementById('musicClose').click();document.getElementById('navidromeOpen').click()")
    await waitFor(win,"document.querySelectorAll('.navidrome-album').length > 0 && !document.querySelector('.navidrome-album').disabled")
    await win.webContents.executeJavaScript("document.querySelector('.navidrome-album').click()")
    await waitFor(win,"document.querySelectorAll('.navidrome-track').length === 1 && !document.getElementById('navidromePlayAlbum').disabled")
    await win.webContents.executeJavaScript("document.getElementById('navidromeSaveAlbum').click();document.getElementById('playlistPickerCreate').click();document.getElementById('playlistName').value='Album smoke';document.getElementById('playlistDialogForm').requestSubmit()")
    await waitFor(win,"window.ArtistWavePlaylists.list().some(p=>p.name==='Album smoke'&&p.count===1)")
    await win.webContents.executeJavaScript("document.getElementById('navidromeOpen').click()")
    await waitFor(win,"document.querySelectorAll('.navidrome-album').length > 0 && !document.querySelector('.navidrome-album').disabled")
    await win.webContents.executeJavaScript("document.querySelector('.navidrome-album').click()")
    await waitFor(win,"document.querySelectorAll('.navidrome-track').length === 1 && !document.getElementById('navidromePlayAlbum').disabled")
    if(process.env.NAVIDROME_SMOKE_SCREENSHOT){
      fs.writeFileSync(process.env.NAVIDROME_SMOKE_SCREENSHOT,(await win.webContents.capturePage()).toPNG())
    }
    await win.webContents.executeJavaScript("document.getElementById('navidromePlayAlbum').click()")
    await waitFor(win,"document.getElementById('audio').readyState >= 2")
    assert(streamRequests>0)
    const current = await win.webContents.executeJavaScript("window.ArtistWaveLibrary.getCurrent()")
    assert.equal(current.source,'NAVIDROME')
    assert.equal(current.title,'Test track')
    assert(!current.url.includes('fixture-password'))
    assert(!fs.readFileSync(path.join(userData,'navidrome.bin')).includes(Buffer.from('fixture-user')))
    await win.webContents.executeJavaScript("document.getElementById('audio').currentTime=5")
    await waitFor(win,"document.getElementById('audio').currentTime >= 5")
    await win.webContents.executeJavaScript("document.getElementById('audio').pause()")
    const saved=await win.webContents.executeJavaScript("JSON.parse(localStorage.getItem('artistwave:listening-session:v1'))")
    assert(saved.time>=5);assert.equal(saved.tracks[0].source,'NAVIDROME')
    win.webContents.reload()
    await new Promise(resolve=>win.webContents.once('did-finish-load',resolve))
    await waitFor(win,"window.ArtistWaveConnections?.NAVIDROME?.connected && window.ArtistWaveLibrary?.getCurrent()?.title === 'Test track'")
    assert(await win.webContents.executeJavaScript("document.getElementById('audio').paused && !document.getElementById('audio').getAttribute('src')"))
    await win.webContents.executeJavaScript("document.querySelector('.listening-notice button').click()")
    await waitFor(win,"document.getElementById('audio').currentTime >= 5 && !document.getElementById('audio').paused")
    await win.webContents.executeJavaScript("document.getElementById('openMiniPlayer').click()")
    await delay(800)
    assert.equal(win.getBounds().width,430)
    const title = await win.webContents.executeJavaScript("document.getElementById('miniPlayerFallbackFrame').contentDocument.getElementById('miniTitle').textContent")
    assert.equal(title,'Test track')
    await win.webContents.executeJavaScript("window.AudioWaveNavidrome.disconnect()")
    assert(!fs.existsSync(path.join(userData,'navidrome.bin')))
    console.log('NAVIDROME SMOKE PASSED: unified artist/album browsing, connection, playback, seeking, encrypted storage, paused reload/resume, Mini and disconnect')
    clearTimeout(watchdog);server.close();app.exit(0)
  }catch(error){console.error(error);clearTimeout(watchdog);server.close();app.exit(1)}
})
