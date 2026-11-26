'use strict';
/* Uses YouTube's public IFrame Player API; never overlays the player. */
(function(){
  let apiPromise;
  function api(){
    if(window.YT?.Player)return Promise.resolve(window.YT);
    if(apiPromise)return apiPromise;
    apiPromise=new Promise((resolve,reject)=>{
      const prior=window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady=()=>{prior?.();resolve(window.YT)};
      const script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';
      script.onerror=()=>{apiPromise=null;reject(new Error('YouTube controls unavailable'))};
      document.head.append(script);
    });
    return apiPromise;
  }
  function bind(frame,controls,onUpdate=()=>{}){
    let player=null,generation=0,timer=null,ready=false;
    const toggle=controls.querySelector('[data-yt="toggle"]'),seek=controls.querySelector('[data-yt="seek"]');
    const volume=controls.querySelector('[data-yt="volume"]'),time=controls.querySelector('[data-yt="time"]');
    const clock=value=>{const n=Number.isFinite(value)?Math.max(0,Math.floor(value)):0;return Math.floor(n/60)+':'+String(n%60).padStart(2,'0')};
    function update(){
      if(!ready)return;
      try{const state=player.getPlayerState(),duration=player.getDuration()||0,current=player.getCurrentTime()||0;
        toggle.textContent=state===1?'Ⅱ':'▶';toggle.setAttribute('aria-label',state===1?'Pause YouTube video':'Play YouTube video');
        seek.disabled=!duration;seek.value=duration?String(Math.round(current/duration*1000)):'0';time.textContent=clock(current)+' / '+clock(duration);
        const level=player.getVolume?.();if(Number.isFinite(level))volume.value=String(level);
        onUpdate({playing:state===1,current,duration,volume:level,title:player.getVideoData?.()?.title||'YouTube video',artist:player.getVideoData?.()?.author||'YouTube'});
      }catch{}
    }
    function reset(){generation++;ready=false;clearInterval(timer);timer=null;player=null;toggle.disabled=true;seek.disabled=true;volume.disabled=true;time.textContent='0:00 / 0:00'}
    async function attach(){
      reset();const expected=generation;
      try{const yt=await api();if(expected!==generation||!frame.getAttribute('src'))return;
        player=new yt.Player(frame,{events:{onReady:()=>{if(expected!==generation)return;controls.dataset.playerReady='true';delete controls.dataset.playerError;ready=true;toggle.disabled=false;volume.disabled=false;update();timer=setInterval(update,500)},onStateChange:update,onError:event=>{if(expected===generation){reset();controls.dataset.playerError=String(event.data)}}}});
      }catch{reset()}
    }
    const command=(name,value)=>{if(!ready)return;try{if(name==='toggle')player.getPlayerState()===1?player.pauseVideo():player.playVideo();else if(name==='seek')player.seekTo(player.getDuration()*value,true);else if(name==='volume')player.setVolume(value);else if(name==='next')player.nextVideo();else if(name==='previous')player.previousVideo()}catch{}};
    toggle.addEventListener('click',()=>command('toggle'));
    seek.addEventListener('input',()=>{if(ready)try{player.seekTo(player.getDuration()*Number(seek.value)/1000,true)}catch{}});
    volume.addEventListener('input',()=>{if(ready)try{player.setVolume(Number(volume.value))}catch{}});
    const position=()=>{if(!ready)return 0;try{return Math.max(0,Math.floor(player.getCurrentTime()||0))}catch{return 0}};
    reset();return {attach,reset,command,position};
  }
  window.ArtistWaveYouTubeControls={bind};
})();
