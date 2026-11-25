'use strict';
/* Pop-out UI: reads and controls the one playback engine in the main window. */
(function(){
  const $=id=>document.getElementById(id);
  const embedded=new URLSearchParams(location.search).get('embedded')==='1';
  let host=null,lastQueue='',lastCover='',draggingSeek=false,draggingVolume=false,libraryLimit=150,upNextLimit=100;
  const miniView=$('miniViewToggle');
  function setMiniView(view){
    const artwork=view==='artwork';document.body.dataset.miniView=artwork?'artwork':'queue';
    if(miniView){miniView.setAttribute('aria-pressed',String(artwork));miniView.textContent=artwork?'Queue view':'Artwork view'}
    try{localStorage.setItem('artistwave:mini-view',artwork?'artwork':'queue')}catch{}
  }
  let savedView='queue';try{savedView=localStorage.getItem('artistwave:mini-view')||'queue'}catch{}
  setMiniView(savedView);miniView?.addEventListener('click',()=>setMiniView(document.body.dataset.miniView==='artwork'?'queue':'artwork'));
  function connect(){
    try{
      const origin=embedded?window.parent:window.opener;
      if(!origin||origin===window||origin.closed)return null;
      // Same-origin access only. A disconnected / navigated-away opener is safe.
      return origin.ArtistWaveMiniHost||null;
    }catch{return null}
  }
  function send(action,value){
    const target=connect();
    if(!target)return refresh();
    try{target.command(action,value)}catch{}
    refresh();
  }
  const clock=x=>{
    const n=Number(x);
    if(!Number.isFinite(n)||n<0)return '0:00';
    return Math.floor(n/60)+':'+String(Math.floor(n%60)).padStart(2,'0');
  };
  function updateQueue(queue,selected,smartQueue=[]){
    const signature=JSON.stringify([queue.map(t=>[t.title,t.artist,t.index]),selected,smartQueue.map(t=>[t.title,t.artist,t.index]),libraryLimit,upNextLimit]);
    if(signature===lastQueue)return;
    lastQueue=signature;
    const list=$('miniQueueList');
    const active=list.contains(document.activeElement)?document.activeElement:null;
    const focusedRow=active?.closest('[data-queue-key]');
    const focusedKey=focusedRow?.dataset.queueKey,focusedAction=active?.dataset.queueAction;
    const previousScroll=list.scrollTop;list.replaceChildren();
    $('miniQueueCount').textContent=smartQueue.length?smartQueue.length+' up next · '+queue.length+' in library':queue.length+' track'+(queue.length===1?'':'s');
    if(!queue.length&&!smartQueue.length){
      const p=document.createElement('p');p.className='queue-empty';
      p.textContent='Find music in the main ArtistWave window to start listening.';
      list.append(p);return;
    }
    if(smartQueue.length){
      const label=document.createElement('div');label.className='mini-queue-divider';label.textContent='PLAY NEXT · TEMPORARY';
      list.append(label);
      for(const item of smartQueue.slice(0,upNextLimit)){
        const row=document.createElement('div');row.className='queue-song queue-song-smart';row.dataset.queueKey=JSON.stringify(['next',item.title,item.artist,item.index]);
        const info=document.createElement('span');info.className='song-info';
        const title=document.createElement('strong');title.textContent=item.title;
        const artist=document.createElement('small');artist.textContent=item.artist;
        info.append(title,artist);
        const controls=document.createElement('span');controls.className='mini-queue-actions';
        const action=(label,verb,fn)=>{
          const button=document.createElement('button');button.type='button';
          button.textContent=label;button.title=verb;button.dataset.queueAction=verb;button.setAttribute('aria-label',verb+' '+item.title);
          button.onclick=fn;controls.append(button);
        };
        action('▶','Play now',()=>send('queuePlay',item.index));
        action('↑','Move up',()=>send('queueMove',{index:item.index,direction:-1}));
        action('↓','Move down',()=>send('queueMove',{index:item.index,direction:1}));
        action('×','Remove',()=>send('queueRemove',item.index));
        row.append(info,controls);list.append(row);
      }
      if(smartQueue.length>upNextLimit){
        const more=document.createElement('button');more.type='button';more.className='mini-show-more mini-show-more-next';
        more.textContent='Show more up next ('+(smartQueue.length-upNextLimit)+' remaining)';
        more.onclick=()=>{const firstNew=upNextLimit;upNextLimit+=100;updateQueue(queue,selected,smartQueue);list.querySelectorAll('.queue-song-smart')[firstNew]?.querySelector('button')?.focus()};
        list.append(more);
      }
      if(queue.length){
        const label=document.createElement('div');label.className='mini-queue-divider';label.textContent='YOUR LIBRARY';
        list.append(label);
      }
    }
    for(const track of queue.slice(0,libraryLimit)){
      const button=document.createElement('button');button.type='button';
      button.className='queue-song'+(track.index===selected?' active':'');
      button.dataset.queueKey=JSON.stringify(['library',track.title,track.artist,track.index]);button.dataset.queueAction='play';
      button.setAttribute('aria-label','Play '+track.title+' by '+track.artist);
      button.title=track.title+' — '+track.artist;if(track.index===selected)button.setAttribute('aria-current','true');
      const number=document.createElement('span');number.textContent=track.index===selected?'♫':String(track.index+1).padStart(2,'0');
      const copy=document.createElement('span');copy.className='song-info';
      const title=document.createElement('strong');title.textContent=track.title;
      const artist=document.createElement('small');artist.textContent=track.artist;
      copy.append(title,artist);
      const arrow=document.createElement('span');arrow.textContent=track.index===selected?'●':'▶';
      button.append(number,copy,arrow);
      button.onclick=()=>send('track',track.index);
      list.append(button);
    }
    if(queue.length>libraryLimit){
      const more=document.createElement('button');more.type='button';more.className='mini-show-more mini-show-more-library';
      more.textContent='Show more tracks ('+(queue.length-libraryLimit)+' remaining)';
      more.onclick=()=>{const firstNew=libraryLimit;libraryLimit+=150;updateQueue(queue,selected,smartQueue);list.querySelectorAll('button.queue-song')[firstNew]?.focus()};
      list.append(more);
    }
    list.scrollTop=previousScroll;
    if(focusedKey&&focusedAction){
      const row=Array.from(list.querySelectorAll('[data-queue-key]')).find(node=>node.dataset.queueKey===focusedKey);
      const replacement=row?.dataset.queueAction===focusedAction?row:Array.from(row?.querySelectorAll('[data-queue-action]')||[]).find(node=>node.dataset.queueAction===focusedAction);
      replacement?.focus({preventScroll:true});
    }
  }
  function refresh(){
    host=connect();
    if(!host){
      document.body.classList.add('disconnected');
      $('miniConnection').textContent='Main player disconnected';
      $('miniPlaybackLabel').textContent='RECONNECT ARTISTWAVE';
      $('miniAlwaysOnTop').hidden=true;
      $('miniPlaylists').disabled=true;
      for(const id of ['miniPlay','miniNext','miniPrevious','miniSeek','miniShuffle','miniRepeat','miniVolume','miniFavorite','miniSave'])
        $(id).disabled=true;
      return;
    }
    let state;
    try{state=host.state()}catch{return}
    document.body.classList.remove('disconnected');
    $('miniConnection').textContent='Connected to ArtistWave';
    $('miniPlaybackLabel').textContent=state.playing?'NOW PLAYING':'PAUSED / READY';
    $('miniTitle').textContent=state.title;
    $('miniArtist').textContent=state.artist;
    $('miniSource').textContent=state.source;
    $('miniPlay').textContent=state.playing?'Ⅱ':'▶';
    $('miniPlay').setAttribute('aria-label',state.playing?'Pause':'Play');
    $('miniFavorite').classList.toggle('selected',state.favorite);
    $('miniFavorite').firstChild.textContent=state.favorite?'♥ ':'♡ ';
    $('miniShuffle').classList.toggle('active',state.shuffle);
    $('miniShuffle').setAttribute('aria-pressed',String(Boolean(state.shuffle)));
    $('miniRepeat').classList.toggle('active',state.repeat!=='Repeat: off');
    $('miniRepeat').setAttribute('aria-pressed',String(state.repeat!=='Repeat: off'));
    $('miniRepeat').setAttribute('aria-label',state.repeat||'Repeat off');
    document.body.classList.toggle('is-playing',Boolean(state.playing));
    $('miniRepeat').title=state.repeat;
    $('miniCurrent').textContent=clock(state.currentTime);
    $('miniDuration').textContent=clock(state.duration);
    $('miniSeek').disabled=!state.duration;
    if(!draggingSeek)$('miniSeek').value=state.duration?String(Math.round(state.currentTime/state.duration*1000)):'0';
    if(!draggingVolume)$('miniVolume').value=String(Math.round(state.volume*100));
    $('miniVolumeValue').textContent=Math.round(state.volume*100)+'%';
    for(const id of ['miniPlay','miniNext','miniPrevious','miniShuffle','miniRepeat','miniVolume'])
      $(id).disabled=false;
    $('miniFavorite').disabled=!state.hasTrack;
    $('miniSave').disabled=!state.hasTrack;
    const pin=$('miniAlwaysOnTop');
    pin.hidden=typeof state.alwaysOnTop!=='boolean';
    pin.setAttribute('aria-pressed',String(state.alwaysOnTop===true));
    pin.textContent=state.alwaysOnTop?'On top: on':'On top: off';
    if(lastCover!==state.cover){
      lastCover=state.cover;
      const img=$('miniCoverImage');
      if(state.cover){
        img.hidden=false;
        img.onerror=()=>{img.hidden=true;$('miniArtPlaceholder').hidden=false};
        img.onload=()=>{$('miniArtPlaceholder').hidden=true};
        img.src=state.cover;
      }else{
        img.hidden=true;
        img.removeAttribute('src');
        $('miniArtPlaceholder').hidden=false;
      }
    }
    const saved=$('miniPlaylists');
    const playlists=state.playlists||[];
    const signature=JSON.stringify(playlists);
    saved.disabled=!playlists.length;
    if(saved.dataset.signature!==signature){
      saved.dataset.signature=signature;
      saved.replaceChildren(new Option(playlists.length?'Select a playlist':'No saved playlists yet',''));
      for(const playlist of playlists){
        const option=new Option(playlist.name+' · '+playlist.count+' tracks',playlist.id);
        option.disabled=!playlist.count;
        saved.add(option);
      }
    }
    updateQueue(state.queue||[],state.selected,state.smartQueue||[]);
  }
  const bind=(id,action)=>$(id).addEventListener('click',()=>send(action));
  bind('miniPlay','play');bind('miniPrevious','previous');bind('miniNext','next');
  bind('miniShuffle','shuffle');bind('miniRepeat','repeat');
  bind('miniFavorite','favorite');bind('miniSave','save');
  $('miniAlwaysOnTop').addEventListener('click',()=>send('alwaysOnTop'));
  $('miniPlaylists').addEventListener('change',event=>{
    const selection=event.target;
    if(selection.value)send('playlist',selection.value);
    selection.value='';
  });
  $('miniSeek').addEventListener('input',event=>{draggingSeek=true;send('seek',Number(event.target.value)/1000)});
  $('miniSeek').addEventListener('change',()=>{draggingSeek=false;refresh()});
  $('miniVolume').addEventListener('input',event=>{draggingVolume=true;send('volume',event.target.value)});
  $('miniVolume').addEventListener('change',()=>{draggingVolume=false;refresh()});
  $('miniClose').addEventListener('click',()=>{
    if(embedded)try{window.parent.ArtistWaveMiniHost?.closeFallback()}catch{}
    else window.close();
  });
  $('miniOpenMain').addEventListener('click',()=>{
    try{
      const main=embedded?window.parent:window.opener;
      if(main&&!main.closed){main.focus();if(embedded)main.ArtistWaveMiniHost?.closeFallback();return}
    }catch{}
    if(!embedded)window.open('./','_blank');
  });
  refresh();
  setInterval(refresh,500);
})();
