'use strict';
(function(){
  const providers=[
    {name:'Navidrome',api:window.AudioWaveNavidrome,button:document.getElementById('navidromeOpen')},
    {name:'Plex',api:window.AudioWavePlex,button:document.getElementById('plexOpen')}
  ].filter(item=>item.api&&item.button);
  if(!providers.length)return;
  let api=providers[0].api,provider=providers[0].name;
  for(const item of providers)item.button.hidden=false;
  const dialog=document.createElement('dialog');
  dialog.className='navidrome-dialog';
  dialog.setAttribute('aria-labelledby','navidromeTitle');
  dialog.innerHTML=`
    <header class="navidrome-heading"><h2 id="navidromeTitle">Navidrome library</h2><button type="button" id="navidromeClose" aria-label="Close Navidrome library">×</button></header>
    <details id="navidromeSettings" open><summary>Server connection</summary>
      <form id="navidromeConnect" class="navidrome-connection">
        <label>Server address<input id="navidromeUrl" type="url" placeholder="http://your-nas:4533" required /></label>
        <label>Username<input id="navidromeUser" autocomplete="username" required maxlength="200" /></label>
        <label>Password<input id="navidromePassword" type="password" autocomplete="current-password" required maxlength="2000" /></label>
        <p>Connection credentials are encrypted on this Windows device.</p>
        <div class="navidrome-actions"><button id="navidromeConnectButton" type="submit">Connect</button><button id="navidromeDisconnect" type="button" hidden>Disconnect and forget</button></div>
      </form>
    </details>
    <p id="navidromeStatus" role="status" aria-live="polite"></p>
    <section id="navidromeLibrary" hidden>
      <label id="navidromeSectionLabel" hidden>Music library<select id="navidromeSection" aria-label="Plex music library"></select></label>
      <form id="navidromeSearch" class="navidrome-search"><label for="navidromeQuery">Find albums</label><input id="navidromeQuery" type="search" placeholder="Album or artist" maxlength="200" /><button type="submit">Search</button><button id="navidromeRecent" type="button">Recently added</button></form>
      <div id="navidromeAlbums" class="navidrome-albums"></div>
      <button id="navidromeMore" type="button" hidden>Load more albums</button>
      <section id="navidromeAlbum" hidden><div class="navidrome-heading"><h3 id="navidromeAlbumTitle"></h3><button id="navidromePlayAlbum" type="button">▶ Play album</button><button id="navidromeSaveAlbum" type="button">＋ Add album to playlist</button></div><div id="navidromeTracks"></div></section>
    </section>`;
  document.body.append(dialog);
  const $=id=>dialog.querySelector('#'+id);
  let connection=null,offset=0,query='',tracks=[],albumName='',generation=0,busy=false;
  const report=(message,error=false)=>{
    $('navidromeStatus').textContent=message;
    $('navidromeStatus').classList.toggle('error',error);
  };
  function setBusy(value){
    busy=value;
    $('navidromeSection').disabled=value;
    for(const item of providers)item.button.disabled=value;
    for(const button of dialog.querySelectorAll('button'))if(button.id!=='navidromeClose')button.disabled=value;
  }
  async function run(action){
    if(busy)return;
    setBusy(true);
    try{await action()}catch(error){report(error.message,true)}
    finally{setBusy(false)}
  }
  function showConnection(state){
    connection=state;
    window.ArtistWaveConnections??={};window.ArtistWaveConnections[provider.toUpperCase()]=state;window.dispatchEvent(new Event('artistwave:connections'));
    $('navidromeUrl').value=state.url||'';
    $('navidromeUser').value=state.username||'';
    $('navidromePassword').value='';
    $('navidromeDisconnect').hidden=!state.connected;
    $('navidromeSettings').open=!state.connected;
    $('navidromeLibrary').hidden=!state.connected;
    $('navidromeSectionLabel').hidden=provider!=='Plex';
    $('navidromeSection').replaceChildren(...(state.libraries||[]).map(item=>new Option(item.name,item.id)));
    report(state.error||(state.connected?'Connected to '+state.url:'Connect your music server to browse its library.'),Boolean(state.error));
  }
  function play(index){
    if(!tracks.length)return;
    dialog.close();
    document.getElementById('discoverNav').click();
    window.ArtistWaveLibrary.playPlaylist(tracks,index,albumName);
  }
  async function selectAlbum(album){
    const version=++generation;
    report('Loading '+album.name+'…');
    const result=await api.tracks(album.id);
    if(version!==generation)return;
    tracks=result;albumName=album.name;
    $('navidromeAlbumTitle').textContent=album.name+' · '+album.artist;
    const list=$('navidromeTracks');list.replaceChildren();
    result.forEach((track,index)=>{
      const row=document.createElement('div');row.className='navidrome-track';
      const button=document.createElement('button');button.type='button';
      button.textContent='▶ '+track.title+' · '+track.artist;
      button.onclick=()=>play(index);
      const save=document.createElement('button');save.type='button';save.textContent='＋ Playlist';
      save.setAttribute('aria-label','Add '+track.title+' to a playlist');
      save.onclick=()=>{dialog.close();window.ArtistWavePlaylists?.addTrack(track)};
      row.append(button,save);list.append(row);
    });
    $('navidromeAlbum').hidden=false;
    report(result.length?result.length+' track'+(result.length===1?'':'s'):'This album has no playable tracks.');
    $('navidromeAlbum').scrollIntoView({block:'nearest'});
  }
  async function loadAlbums(reset=false){
    const version=++generation;
    if(reset){offset=0;tracks=[];$('navidromeAlbum').hidden=true;$('navidromeAlbums').replaceChildren()}
    report('Loading albums…');
    const result=await api.albums({offset,query,library:$('navidromeSection').value});
    if(version!==generation)return;
    for(const album of result.albums){
      const button=document.createElement('button');button.type='button';button.className='navidrome-album';
      if(album.artwork){
        const cover=document.createElement('img');cover.src=album.artwork;cover.alt='';cover.loading='lazy';
        cover.onerror=()=>cover.remove();button.append(cover);
      }
      const name=document.createElement('strong');name.textContent=album.name;
      const artist=document.createElement('span');artist.textContent=album.artist;
      button.append(name,artist);button.onclick=()=>run(()=>selectAlbum(album));
      $('navidromeAlbums').append(button);
    }
    offset+=result.albums.length;
    $('navidromeMore').hidden=!result.more;
    report(offset?offset+' albums loaded'+(query?' for “'+query+'”':'. Recently added first.'):'No albums found.');
  }
  for(const item of providers)item.button.addEventListener('click',()=>{
    if(busy)return;
    api=item.api;provider=item.name;
    const plex=provider==='Plex';
    $('navidromeTitle').textContent=provider+' library';
    $('navidromeClose').setAttribute('aria-label','Close '+provider+' library');
    $('navidromeUrl').placeholder=plex?'http://your-nas:32400':'http://your-nas:4533';
    for(const id of ['navidromeUser','navidromePassword']){
      $(id).closest('label').hidden=plex;
      $(id).disabled=plex;
      $(id).required=!plex;
    }
    $('navidromeConnectButton').textContent=plex?'Sign in with Plex':'Connect';
    $('navidromeQuery').placeholder=plex?'Album title':'Album or artist';
    query='';$('navidromeQuery').value='';
    $('navidromeAlbums').replaceChildren();$('navidromeAlbum').hidden=true;
    showConnection({connected:false});
    dialog.showModal();
    run(async()=>{showConnection(await api.status());if(connection.connected&&!connection.error)await loadAlbums(true)});
  });
  $('navidromeClose').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{
    $('navidromePassword').value='';
    if(busy&&provider==='Plex')void api.cancel().catch(()=>{});
  });
  $('navidromeConnect').onsubmit=event=>{
    event.preventDefault();
    run(async()=>{
      const input={url:$('navidromeUrl').value,username:$('navidromeUser').value,password:$('navidromePassword').value};
      $('navidromePassword').value='';
      report(provider==='Plex'?'Complete Plex sign-in in your browser. Close this window to cancel.':'Connecting…');
      showConnection(await api.connect(input));
      query='';$('navidromeQuery').value='';
      await loadAlbums(true);
    });
  };
  $('navidromeDisconnect').onclick=()=>run(async()=>{
    showConnection(await api.disconnect());generation++;
    tracks=[];$('navidromeAlbums').replaceChildren();$('navidromeTracks').replaceChildren();
  });
  $('navidromeSearch').onsubmit=event=>{
    event.preventDefault();run(async()=>{query=$('navidromeQuery').value.trim();await loadAlbums(true)});
  };
  $('navidromeRecent').onclick=()=>run(async()=>{query='';$('navidromeQuery').value='';await loadAlbums(true)});
  $('navidromeMore').onclick=()=>run(()=>loadAlbums());
  $('navidromeSection').onchange=()=>run(()=>loadAlbums(true));
  $('navidromePlayAlbum').onclick=()=>play(0);
  $('navidromeSaveAlbum').onclick=()=>{dialog.close();window.ArtistWavePlaylists?.addAlbum(tracks,albumName)};
})();
