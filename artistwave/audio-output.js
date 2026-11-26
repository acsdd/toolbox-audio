'use strict';
/* Both local audio elements share one output choice. The browser's embedded
   YouTube player is a separate origin and cannot be routed by this page. */
(function(){
  const select=document.getElementById('audioOutputSelect'),refreshButton=document.getElementById('audioOutputRefresh'),status=document.getElementById('audioOutputStatus');
  const players=[document.getElementById('audio'),document.getElementById('studioAudio')].filter(Boolean);
  if(!select||!refreshButton||!status||!players.length)return;
  const key='artistwave:audio-output';
  let preferred='';try{preferred=localStorage.getItem(key)||''}catch{}
  let active='',generation=0,applying=Promise.resolve();
  const supported=players.every(player=>typeof player.setSinkId==='function');
  const say=message=>{status.textContent=message};
  function save(value){preferred=value;try{if(value)localStorage.setItem(key,value);else localStorage.removeItem(key)}catch{}}
  async function route(id){
    const previous=active;
    try{for(const player of players)await player.setSinkId(id);active=id;return true}
    catch(error){
      for(const player of players)try{await player.setSinkId(previous)}catch{}
      return false;
    }
  }
  function change(id,persist){
    const task=async()=>{
      select.disabled=true;
      const ok=await route(id);
      if(ok){if(persist)save(id);select.value=id;say(id?'Audio output selected.':'Using the system default output.')}
      else{select.value=active;say('Could not switch audio output. Check that the device is connected.')}
      select.disabled=false;return ok;
    };
    applying=applying.then(task,task);return applying;
  }
  async function listDevices(){
    if(window.AudioWaveOutputs?.list)return window.AudioWaveOutputs.list();
    if(navigator.mediaDevices?.enumerateDevices)return navigator.mediaDevices.enumerateDevices();
    return [];
  }
  async function refresh(){
    const request=++generation;
    if(!supported){select.disabled=true;refreshButton.disabled=true;say('Audio output selection is not supported here.');return}
    try{
      const result=await listDevices();await applying;if(request!==generation)return;
      const devices=(Array.isArray(result)?result:[]).filter(device=>device.kind===undefined||device.kind==='audiooutput');
      const distinct=[];const seen=new Set(['','default']);
      for(const device of devices){if(typeof device.deviceId!=='string'||seen.has(device.deviceId))continue;seen.add(device.deviceId);distinct.push(device)}
      const current=active;select.replaceChildren(new Option('System default',''));
      distinct.forEach((device,index)=>select.add(new Option(device.label||'Audio output '+(index+1),device.deviceId)));
      const available=distinct.some(device=>device.deviceId===preferred);
      if(preferred&&!available){
        if(active&&!(await change('',false))){say('Saved output is unavailable; could not switch to the system default.');return}
        select.value='';say('Saved output is unavailable. Using the system default.');
      }else if(preferred&&preferred!==current){
        const ok=await change(preferred,false);if(!ok)say('Saved output could not be restored. Using the system default.');
      }else{
        select.value=active;
        say(distinct.length?'Choose where AudioWave plays.':'Only the system default is available.');
      }
    }catch{say('Could not list audio outputs. Using the current output.')}
  }
  select.addEventListener('change',()=>{void change(select.value,true)});
  refreshButton.addEventListener('click',()=>{void refresh()});
  navigator.mediaDevices?.addEventListener?.('devicechange',()=>{void refresh()});
  window.addEventListener?.('focus',()=>{void refresh()});
  void refresh();
})();
