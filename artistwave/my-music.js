'use strict';
(function(){
  const $=id=>document.getElementById(id),data=window.ArtistWaveLibraryData;
  const providers=[['NAVIDROME','Navidrome',window.AudioWaveNavidrome,'navidromeOpen'],['PLEX','Plex',window.AudioWavePlex,'plexOpen']].filter(p=>p[2]);
  window.ArtistWaveConnections??={};
  const nav=document.createElement('button');nav.type='button';nav.className='nav-item';nav.id='myMusicOpen';nav.textContent='♫ My Music';
  $('myPlaylistsNav').before(nav);
  const dialog=document.createElement('dialog');dialog.className='music-dialog';dialog.setAttribute('aria-labelledby','musicTitle');
  dialog.innerHTML=`<header class="music-heading"><div><p class="overline">YOUR LIBRARY</p><h2 id="musicTitle">My Music</h2></div><button id="musicClose" aria-label="Close My Music">×</button></header>
    <div class="music-connections" id="musicConnections"></div>
    <form id="musicFilters" class="music-filters"><label>Source<select id="musicSource"><option value="all">All sources</option><option value="LOCAL">Local files</option></select></label><label>Search albums<input id="musicSearch" type="search" placeholder="Artist or album" /></label><label>Sort<select id="musicSort"><option value="recent">Source order (recent first)</option><option value="name">Album name</option><option value="artist">Artist name</option><option value="year">Year (newest first)</option></select></label><button type="button" id="musicRefresh">Refresh</button><button type="button" id="musicCancelScan" hidden>Stop indexing</button></form>
    <p id="musicStatus" role="status" aria-live="polite"></p><div class="music-breadcrumb" id="musicBreadcrumb"></div><div id="musicAlbums" class="music-albums"></div><div id="musicMore" class="music-more"></div><section id="musicTracks" hidden></section>`;
  document.body.append(dialog);
  for(const [key,name] of providers)$('musicSource').add(new Option(name,key));
  let albums=[],pages=[],albumKeys=new Set(),artist='',generation=0,loading=false,scanToken=0,scanning=false,visibleLimit=200;
  const node=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls;if(text!==undefined)n.textContent=text;return n};
  function button(text,action){const b=node('button','',text);b.type='button';b.onclick=action;return b}
  function status(message){$('musicStatus').textContent=message}
  function localAlbums(){
    const groups=new Map();
    for(const t of window.ArtistWaveLibrary.getLocal()){
      const key=t.artist+'\u0000'+t.collection;
      if(!groups.has(key))groups.set(key,{id:key,name:t.collection||'Singles',artist:t.artist,source:'LOCAL',year:t.year||0,tracks:[]});
      groups.get(key).tracks.push(t);
    }
    return [...groups.values()].reverse();
  }
  function connectionCards(){
    const container=$('musicConnections');container.replaceChildren();
    const local=node('section','music-connection');local.append(node('strong','','Local files'),node('p','',window.ArtistWaveLibrary.getLocal().length+' tracks on this device'),button('Add music folder',()=>{dialog.close();document.querySelector('.sidebar-local-tools .nav-item').click()}));container.append(local);
    for(const [key,name,api,open] of providers){
      const state=window.ArtistWaveConnections[key];const card=node('section','music-connection');
      card.append(node('strong','',name),node('p','',state?.error||(!state?'Not checked':state.connected?(state.checked?'Connected':'Connection saved'):'Not connected')),button(state?.connected?'Manage connection':'Connect',()=>{dialog.close();$(open).click()}));
      container.append(card);
    }
  }
  async function loadPage(page,version){
    if(page.busy)return;page.busy=true;
    try{
      const result=await page.api.albums({offset:page.offset,library:page.library});
      if(version!==generation)return;
      const prior=albums.length;
      for(const album of result.albums){const key=JSON.stringify([page.source,page.library,album.id]);if(!albumKeys.has(key)){albumKeys.add(key);albums.push({...album,source:page.source,library:page.library,api:page.api})}}
      page.offset+=result.albums.length;page.more=Boolean(result.more&&result.albums.length);page.error='';
      if(page.more&&albums.length===prior){page.more=false;page.error='The server repeated a page; refresh the library to try again.'}
      Object.assign(window.ArtistWaveConnections[page.source],{checked:true,error:''});window.dispatchEvent(new Event('artistwave:connections'));
    }catch(error){if(version===generation){page.error=error.message;page.more=true;window.ArtistWaveConnections[page.source].error=error.message;window.dispatchEvent(new Event('artistwave:connections'))}}
    finally{page.busy=false;if(version===generation)render()}
  }
  async function scanRemaining(version){
    const token=++scanToken;scanning=true;$('musicCancelScan').hidden=false;render();
    const work=pages.map(async page=>{
      while(page.more&&!page.error&&version===generation&&token===scanToken){
        await loadPage(page,version);
        await new Promise(resolve=>setTimeout(resolve,0));
      }
    });
    await Promise.all(work);
    if(version===generation&&token===scanToken){scanning=false;$('musicCancelScan').hidden=true;render()}
  }
  async function refresh(){
    ++scanToken;scanning=false;$('musicCancelScan').hidden=true;
    const version=++generation;loading=true;$('musicRefresh').disabled=true;artist='';albums=localAlbums();pages=[];albumKeys=new Set();$('musicTracks').hidden=true;render();status('Checking music sources…');
    await Promise.all(providers.map(async([key,name,api])=>{
      try{
        const state=await api.status();if(version!==generation)return;
        window.ArtistWaveConnections[key]=state;
        if(state.connected&&!state.error){
          const libraries=key==='PLEX'?state.libraries||[]:[{id:'',name}];
          await Promise.all(libraries.map(async library=>{const page={source:key,name:name+(library.id?' · '+library.name:''),api,library:library.id,offset:0,more:true};pages.push(page);await loadPage(page,version)}));
        }
      }catch(error){if(version===generation)window.ArtistWaveConnections[key]={connected:false,error:error.message}}
    }));
    if(version!==generation)return;
    loading=false;$('musicRefresh').disabled=false;connectionCards();render();window.dispatchEvent(new Event('artistwave:connections'));
    if(pages.some(page=>page.more&&!page.error))void scanRemaining(version);
  }
  async function openAlbum(album){
    const version=generation;const panel=$('musicTracks');panel.hidden=false;panel.replaceChildren(node('p','','Loading '+album.name+'…'));
    try{
      const tracks=album.tracks||await album.api.tracks(album.id);if(version!==generation)return;
      panel.replaceChildren(node('h3','',album.name+' · '+album.artist));
      const play=index=>{dialog.close();$('discoverNav').click();window.ArtistWaveLibrary.playPlaylist(tracks,index,album.name)};
      if(!tracks.length)panel.append(node('p','','No playable tracks in this album.'));
      else panel.append(button('▶ Play album',()=>play(0)));
      tracks.forEach((track,index)=>{const row=node('div','music-track');row.append(button('▶ '+track.title,()=>play(index)),node('span','',track.artist),button('＋ Playlist',()=>{dialog.close();window.ArtistWavePlaylists.addTrack(track)}));panel.append(row)});
      panel.scrollIntoView({block:'nearest'});
    }catch(error){if(version===generation){panel.replaceChildren(node('p','',error.message),button('Retry',()=>openAlbum(album)))}}
  }
  function render(){
    connectionCards();
    const source=$('musicSource').value,query=$('musicSearch').value.trim().toLocaleLowerCase(),sort=$('musicSort').value;
    let list=albums.filter(a=>(source==='all'||a.source===source)&&(!query||(a.name+' '+a.artist).toLocaleLowerCase().includes(query)));
    const count=list.length;
    if(artist)list=list.filter(a=>a.artist===artist);
    if(sort==='name')list.sort((a,b)=>a.name.localeCompare(b.name));
    if(sort==='artist')list.sort((a,b)=>a.artist.localeCompare(b.artist)||a.name.localeCompare(b.name));
    if(sort==='year')list.sort((a,b)=>(b.year||0)-(a.year||0)||a.name.localeCompare(b.name));
    const crumbs=$('musicBreadcrumb');crumbs.replaceChildren(button('All artists',()=>{artist='';$('musicTracks').hidden=true;render()}));
    if(artist)crumbs.append(node('strong','',artist));
    const grid=$('musicAlbums');grid.replaceChildren();
    if(!artist&&sort==='artist'){
      for(const name of [...new Set(list.map(a=>a.artist))])grid.append(button(name+' · '+list.filter(a=>a.artist===name).length+' albums',()=>{artist=name;render()}));
    }else for(const album of list.slice(0,visibleLimit)){
      const card=node('article','music-album');
      const open=button('',()=>openAlbum(album));open.className='music-album-open';
      if(album.artwork){const image=node('img','');image.src=album.artwork;image.alt='';image.loading='lazy';image.onerror=()=>image.remove();open.append(image)}
      open.append(node('strong','',album.name),node('span','',album.source+(album.year?' · '+album.year:'')));
      card.append(open,button(album.artist,()=>{artist=album.artist;$('musicTracks').hidden=true;render()}));grid.append(card);
    }
    if(!list.length)grid.append(node('p','music-empty',loading?'Loading your library…':'No matching albums. Add a local folder, connect a server, or clear your filters.'));
    const more=$('musicMore');more.replaceChildren();
    if(list.length>visibleLimit)more.append(button('Show more results ('+(list.length-visibleLimit)+' remaining)',()=>{visibleLimit+=200;render()}));
    for(const page of pages.filter(p=>p.more&&(source==='all'||p.source===source))){
      const b=button(page.error?'Retry '+page.name:'Load more · '+page.name,()=>loadPage(page,generation));b.disabled=page.busy;more.append(b);if(page.error)more.append(node('p','',page.error));
    }
    const incomplete=pages.filter(p=>p.more||p.error).length;
    status(count+' albums indexed. '+(scanning?'Indexing remaining albums… Search updates as they arrive.':incomplete?'Some libraries are incomplete or offline. Retry or refresh to continue.':'Album index complete for connected sources.'));
  }
  nav.onclick=()=>{dialog.showModal();refresh()};
  $('musicClose').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{generation++;scanToken++;scanning=false;loading=false;$('musicCancelScan').hidden=true;$('musicRefresh').disabled=false});
  $('musicFilters').onsubmit=e=>e.preventDefault();
  for(const id of ['musicSource','musicSort'])$(id).onchange=()=>{artist='';visibleLimit=200;$('musicTracks').hidden=true;render()};
  $('musicSearch').oninput=()=>{artist='';visibleLimit=200;render()};$('musicRefresh').onclick=refresh;
  $('musicCancelScan').onclick=()=>{scanToken++;scanning=false;$('musicCancelScan').hidden=true;render()};
  window.addEventListener('artistwave:local-library',()=>{albums=albums.filter(a=>a.source!=='LOCAL').concat(localAlbums());if(dialog.open)render()});
  // Availability checks also serve saved playlists outside this dialog.
  Promise.all(providers.map(async([key,,api])=>{try{window.ArtistWaveConnections[key]=await api.status()}catch(error){window.ArtistWaveConnections[key]={connected:false,error:error.message}}})).then(()=>window.dispatchEvent(new Event('artistwave:connections')));
})();
