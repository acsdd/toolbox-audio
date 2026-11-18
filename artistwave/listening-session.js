'use strict';
(function(){
  const KEY='artistwave:listening-session:v1',audio=document.getElementById('audio'),library=window.ArtistWaveLibrary;
  let restored=null,lastSave=0;
  const clean=track=>window.ArtistWavePlaylists.cleanTrack(track);
  const cleanOrigin=origin=>origin?{track:clean(origin.track),nextTrack:clean(origin.nextTrack),index:Number(origin.index)||0,albumQueue:Array.isArray(origin.albumQueue)?origin.albumQueue.filter(x=>typeof x==='string').slice(0,500):[]}:null;
  const notice=document.createElement('div');notice.className='listening-notice';notice.hidden=true;notice.setAttribute('role','status');
  const message=document.createElement('span'),resume=document.createElement('button'),manage=document.createElement('button'),dismiss=document.createElement('button');
  resume.type=manage.type=dismiss.type='button';resume.textContent='Resume';manage.textContent='Open My Music';dismiss.textContent='Dismiss';
  notice.append(message,resume,manage,dismiss);document.querySelector('.main').prepend(notice);
  manage.onclick=()=>document.getElementById('myMusicOpen').click();dismiss.onclick=()=>{notice.hidden=true};
  function show(text,label='Resume'){message.textContent=text;resume.textContent=label;notice.hidden=false}
  function save(){
    const state=library.sessionSnapshot();if(state.selected<0||!state.tracks.length)return;
    const tracks=state.tracks.slice(0,500).map(clean);if(!tracks[state.selected])return;
    // Preserve index alignment; unsupported entries cannot be safely resumed.
    if(tracks.some(t=>!t))return;
    const time=restored?restored.time:state.time;
    try{localStorage.setItem(KEY,JSON.stringify({...state,tracks,time,smartOrigin:cleanOrigin(state.smartOrigin),smartQueue:state.smartQueue.map(clean).filter(Boolean).slice(0,100)}))}catch{}
  }
  function resumeListening(){
    const time=restored?.time||0;
    if(!library.resumeSession(time)){show('This track needs its local folder or original server connection. Open My Music, reconnect, then retry.','Retry');return false}
    restored=null;notice.hidden=true;return true;
  }
  resume.onclick=resumeListening;window.ArtistWaveSession={resume:resumeListening};
  try{
    const saved=JSON.parse(localStorage.getItem(KEY)||'null');
    if(saved&&Array.isArray(saved.tracks)&&Number.isInteger(saved.selected)&&saved.selected>=0&&saved.selected<saved.tracks.length){
      saved.tracks=saved.tracks.slice(0,500).map(clean);
      saved.smartQueue=(Array.isArray(saved.smartQueue)?saved.smartQueue:[]).map(clean).filter(Boolean).slice(0,100);
      saved.smartOrigin=cleanOrigin(saved.smartOrigin);saved.albumQueue=Array.isArray(saved.albumQueue)?saved.albumQueue.filter(x=>typeof x==='string').slice(0,500):[];
      saved.time=Number.isFinite(saved.time)?Math.max(0,saved.time):0;
      if(saved.tracks.every(Boolean)&&library.restoreSession(saved)){restored=saved;show('Ready to resume '+saved.tracks[saved.selected].title+' at '+Math.floor(saved.time/60)+':'+String(Math.floor(saved.time%60)).padStart(2,'0')+'. Playback is paused.')}
    }
  }catch{}
  audio.addEventListener('timeupdate',()=>{if(Date.now()-lastSave>5000){lastSave=Date.now();save()}});
  audio.addEventListener('playing',()=>{restored=null;notice.hidden=true;save()});audio.addEventListener('pause',save);
  window.addEventListener('pagehide',save);window.addEventListener('beforeunload',save);
  window.addEventListener('artistwave:playback-error',async event=>{
    const track=event.detail?.track;if(!track)return;
    const api=track.source==='PLEX'?window.AudioWavePlex:track.source==='NAVIDROME'?window.AudioWaveNavidrome:null;
    let reason='The media could not be played. The file may be unavailable or its format unsupported.';
    if(api){try{const state=await api.status();window.ArtistWaveConnections[track.source]=state;if(state.connected&&!state.error)await api.albums({offset:0});reason=state.error||(!state.connected?'Reconnect your '+track.source+' server in My Music.':'The server could not deliver this track. Check its connection and media format.')}catch(error){reason=error.message||'The server could not be reached. Check its address and network connection.'}}
    if(library.getCurrent()!==track)return;show(reason,'Retry');
  });
})();
