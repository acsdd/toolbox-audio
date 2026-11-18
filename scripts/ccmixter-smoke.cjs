const { app } = require('electron')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'audiowave-ccmixter-')))
const timeout=setTimeout(()=>{console.error('ccMixter check timed out');app.exit(1)},45000)
const main=process.argv[2]?path.resolve(process.argv[2]):path.join(__dirname,'desktop.cjs')
require(main).then(async win=>{
  const outcome=await win.webContents.executeJavaScript(`(async()=>{
    document.getElementById('providerCcMixter').checked=true;
    const records=await window.AudioWaveCcMixter.search('airtone');
    const tracks=normalizeCcMixterTracks(records,'airtone');
    if(!tracks.length)throw Error('No playable licensed airtone result');
    window.ArtistWaveLibrary.playPlaylist(tracks,0,'ccMixter');
    const audio=document.getElementById('audio');
    return await new Promise((resolve,reject)=>{
      if(audio.readyState>=2&&!audio.paused)return resolve({title:tracks[0].title,source:tracks[0].source,license:!!tracks[0].licenseUrl});
      const timer=setTimeout(()=>reject(Error('Playback did not start')),20000);
      audio.addEventListener('playing',()=>{clearTimeout(timer);resolve({title:tracks[0].title,source:tracks[0].source,license:!!tracks[0].licenseUrl})},{once:true});
      audio.addEventListener('error',()=>{clearTimeout(timer);reject(Error('Audio playback failed'))},{once:true});
    });
  })()`)
  assert.equal(outcome.source,'CCMIXTER');assert(outcome.license)
  console.log('ccMixter live playback passed:',outcome.title)
  clearTimeout(timeout);app.exit(0)
}).catch(error=>{console.error(error);clearTimeout(timeout);app.exit(1)})
