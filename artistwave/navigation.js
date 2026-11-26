'use strict';
/* Three separate listening workspaces. The YouTube view uses only YouTube's
 * official visible embedded player; never fetches or extracts audio streams. */
(function(){
  const $=id=>document.getElementById(id);
  const tabs={audio:$('modeAudio'),studio:$('studioNav')};
  const frame=$('youtubeFrame');
  let savedMusicDisplay=null;
  const displayIds=['nowTitle','nowArtist','playingSource','currentTime','duration'];
  const clock=value=>{const n=Math.max(0,Math.floor(value||0));return Math.floor(n/60)+':'+String(n%60).padStart(2,'0')};
  function showYouTube(status){
    if(!savedMusicDisplay)return;
    $('nowTitle').textContent=status.title;$('nowArtist').textContent=status.artist;$('playingSource').textContent='YOUTUBE';
    $('currentTime').textContent=clock(status.current);$('duration').textContent=clock(status.duration);
    $('seekBar').value=status.duration?String(Math.round(status.current/status.duration*1000)):'0';
    if(Number.isFinite(status.volume))$('volumeBar').value=String(status.volume);
    $('playButton').textContent=status.playing?'Ⅱ':'▶';$('playButton').setAttribute('aria-label',status.playing?'Pause YouTube video':'Play YouTube video');
  }
  const controls=window.ArtistWaveYouTubeControls.bind(frame,$('youtubePlayerRegion'),showYouTube);
  function beginYouTubeDisplay(){
    if(!savedMusicDisplay)savedMusicDisplay=Object.fromEntries(displayIds.map(id=>[id,$(id).textContent]));
    $('nowTitle').textContent='YouTube video';$('nowArtist').textContent='YouTube';$('playingSource').textContent='YOUTUBE';
  }
  function restoreMusicDisplay(){
    if(!savedMusicDisplay)return;
    for(const [id,value] of Object.entries(savedMusicDisplay))$(id).textContent=value;
    savedMusicDisplay=null;$('playButton').textContent=$('audio').paused?'▶':'Ⅱ';$('playButton').setAttribute('aria-label',$('audio').paused?'Play':'Pause');
    $('volumeBar').value=String(Math.round($('audio').volume*100));
    $('seekBar').value=Number.isFinite($('audio').duration)&&$('audio').duration?String(Math.round($('audio').currentTime/$('audio').duration*1000)):'0';
  }
  for(const [id,action] of [['playButton','toggle'],['previousButton','previous'],['nextButton','next'],['seekBar','seek'],['volumeBar','volume'],['shuffleButton','none'],['repeatButton','none'],['favoriteCurrent','none'],['playlistSaveCurrent','none']]){
    const event=id==='seekBar'||id==='volumeBar'?'input':'click';
    $(id).addEventListener(event,e=>{if(!savedMusicDisplay)return;e.preventDefault();e.stopImmediatePropagation();
      const value=action==='seek'?Number(e.target.value)/1000:action==='volume'?Number(e.target.value):undefined;
      if(action!=='none')controls.command(action,value);
    },true);
  }
  const apiKeyStorage='artistwave.youtubeDataApiKey';
  let mode='audio';
  function readYouTubeApiKey(){try{return window.localStorage?.getItem(apiKeyStorage)||''}catch{return ''}}
  function writeYouTubeApiKey(key){try{if(key)window.localStorage?.setItem(apiKeyStorage,key);else window.localStorage?.removeItem(apiKeyStorage);return Boolean(window.localStorage)}catch{return false}}
  function parseYouTubeUrl(value){
    let url;
    try{url=new URL(String(value||'').trim())}catch{return null}
    if(url.protocol!=='https:')return null;
    const host=url.hostname.toLowerCase();
    const full=['www.youtube.com','youtube.com','m.youtube.com','music.youtube.com','youtube-nocookie.com','www.youtube-nocookie.com'];
    const short=['youtu.be','www.youtu.be'];
    const videoId=host.endsWith('.youtube.com')||full.includes(host) ? (
      url.pathname==='/watch'?url.searchParams.get('v'):
      /^\/(embed|shorts|live)\/([A-Za-z0-9_-]{11})\/?$/.test(url.pathname)?url.pathname.split('/')[2]:null
    ):short.includes(host)?url.pathname.split('/')[1]:null;
    const safeId=/^[A-Za-z0-9_-]{11}$/.test(videoId||'')?videoId:null;
    const listId=full.includes(host)&&/^[A-Za-z0-9_-]{12,80}$/.test(url.searchParams.get('list')||'')?url.searchParams.get('list'):null;
    if(!safeId&&!listId)return null;
    const base='https://www.youtube.com/embed/';
    if(safeId)return base+safeId+(listId?'?list='+encodeURIComponent(listId):'');
    return base+'videoseries?list='+encodeURIComponent(listId);
  }
  function updateYouTubeAccount(){
    // Google Drive OAuth does not create a youtube.com sign-in cookie.
    // YouTube's own embedded player can use an existing browser session
    // where privacy settings permit it; ArtistWave cannot verify that state.
    const connected=Boolean(window.ArtistWaveCloud?.isSignedIn?.());
    $('youtubeAccountHeading').textContent=connected?'Google connected to ArtistWave':'YouTube account';
    $('youtubeAccountStatus').textContent=connected
      ?'ArtistWave is signed into Google. The YouTube player will attempt to use your existing YouTube browser session, if available. If it asks you to sign in, open YouTube in a new tab.'
      :'YouTube uses a separate browser session. Sign into YouTube in a new tab if you want your account there.';
    $('youtubeSignInLink').textContent=connected?'Continue with YouTube ↗':'Open YouTube / Sign in ↗';
  }
  function stopVideo(){
    controls.reset();
    restoreMusicDisplay();
    window.ArtistWaveMiniHost?.endVideo?.();
    frame.removeAttribute('src');
    $('youtubePlayerRegion').hidden=true;
    $('youtubeMiniPlayer').disabled=true;
  }
  function loadVideo(url,{autoplay=false}={}){
    window.ArtistWaveMiniHost?.endVideo?.();
    beginYouTubeDisplay();
    const playerUrl=new URL(url);playerUrl.searchParams.set('enablejsapi','1');playerUrl.searchParams.set('origin',location.origin);playerUrl.searchParams.set('playsinline','1');
    $('youtubePlayerRegion').hidden=false;
    if(autoplay)playerUrl.searchParams.set('autoplay','1');
    frame.src=playerUrl.href;
    $('youtubeMiniPlayer').disabled=false;
    controls.attach();
  }
  function takeVideo(){
    if(mode!=='audio'||!document.body.classList.contains('youtube-widget-open'))return '';
    let url=frame.getAttribute('src')||'';
    const position=controls.position();
    if(url){const resume=new URL(url);resume.searchParams.delete('autoplay');if(position)resume.searchParams.set('start',String(position));url=resume.href}
    controls.reset();
    frame.removeAttribute('src');
    $('youtubePlayerRegion').hidden=true;
    return url;
  }
  function restoreVideo(url){
    if(mode!=='audio'||!document.body.classList.contains('youtube-widget-open')||!url)return;
    frame.src=url;
    $('youtubePlayerRegion').hidden=false;
    $('youtubeMiniPlayer').disabled=false;
    controls.attach();
    setYouTubeMessage('Video returned to the full player. Press play to continue.');
  }
  function setYouTubeMessage(message,isError=false){
    $('youtubeMessage').textContent=message;
    $('youtubeMessage').classList.toggle('error',isError);
  }
  function renderYouTubeResults(items,results=$('youtubeSearchResults')){
    results.replaceChildren();
    for(const item of items){
      const video=item.id?.videoId;
      const snippet=item.snippet;
      if(!/^[A-Za-z0-9_-]{11}$/.test(video||'')||!snippet)continue;
      const button=document.createElement('button');
      button.type='button';button.className='youtube-result';
      const image=document.createElement('img');
      image.src=snippet.thumbnails?.medium?.url||snippet.thumbnails?.default?.url||'';
      image.alt='';image.loading='lazy';
      const copy=document.createElement('span');copy.className='youtube-result-copy';
      const title=document.createElement('strong');title.textContent=snippet.title||'Untitled video';
      const channel=document.createElement('small');channel.textContent=snippet.channelTitle||'YouTube';
      copy.append(title,channel);button.append(image,copy);
      button.addEventListener('click',()=>{
        window.ArtistWaveStudioHost?.pauseMain?.();
        openWidget(false);
        loadVideo('https://www.youtube.com/embed/'+encodeURIComponent(video),{autoplay:true});
        setYouTubeMessage('Now playing in YouTube’s official player. Some videos do not allow embedding.');
      });
      results.append(button);
    }
  }
  async function searchYouTube(query){
    const key=$('youtubeApiKey').value.trim()||readYouTubeApiKey();
    if(!key){$('youtubeApiSetup').open=true;setYouTubeMessage('Add a YouTube Data API key in Search setup to show results here.',true);return}
    const results=$('youtubeSearchResults');results.replaceChildren();
    setYouTubeMessage('Searching YouTube…');
    try{
      const params=new URLSearchParams({part:'snippet',type:'video',videoEmbeddable:'true',maxResults:'12',q:query,key});
      const response=await fetch('https://www.googleapis.com/youtube/v3/search?'+params);
      const data=await response.json();
      if(!response.ok)throw new Error(data.error?.message||'YouTube search could not be completed.');
      renderYouTubeResults(data.items||[]);
      setYouTubeMessage(data.items?.length?'Choose a video to play it here.':'No videos found. Try another search.');
    }catch(error){setYouTubeMessage(error.message||'YouTube search failed. Check the API key and try again.',true)}
  }
  let discoverRequest=0,discoverAbort=null;
  async function searchYouTubeFromEntertainment(query){
    const request=++discoverRequest;
    discoverAbort?.abort();discoverAbort=null;
    const panel=$('youtubeDiscover'),results=$('youtubeDiscoverResults'),status=$('youtubeDiscoverStatus'),setup=$('youtubeDiscoverSetup');
    results.replaceChildren();setup.hidden=true;
    if($('sourceMode').value==='local'){panel.hidden=true;return}
    panel.hidden=false;
    const key=$('youtubeApiKey').value.trim()||readYouTubeApiKey();
    if(!key){status.textContent='Add a YouTube API key to include videos in search.';setup.hidden=false;return}
    status.textContent='Finding videos…';
    const abort=new AbortController();discoverAbort=abort;
    try{
      const params=new URLSearchParams({part:'snippet',type:'video',videoEmbeddable:'true',maxResults:'12',q:query,key});
      const response=await fetch('https://www.googleapis.com/youtube/v3/search?'+params,{signal:abort.signal});
      if(!response.ok)throw new Error('search failed');
      const data=await response.json();
      if(request!==discoverRequest)return;
      renderYouTubeResults(data.items||[],results);
      status.textContent=results.children.length?'Choose a video to play.':'No embeddable videos found.';
    }catch(error){
      if(request!==discoverRequest||error?.name==='AbortError')return;
      status.textContent='YouTube search is unavailable. Check the API key and try again.';setup.hidden=false;
    }finally{if(request===discoverRequest)discoverAbort=null}
  }
  function setMode(target){
    if(target==='youtube'){openWidget();return}
    if(!tabs[target])return;
    // A single handler owns workspace visibility. Never rely on the previous
    // mode: an account action, sidebar link or a direct Studio close may have
    // altered visibility without changing the navigation's previous mode.
    if(target==='studio'){
      window.ArtistWaveStudio?.open();
    }else{
      window.ArtistWaveStudio?.close();
    }
    if(target==='studio'){stopVideo();document.body.classList.remove('youtube-widget-open');$('youtubeWorkspace').hidden=true}
    if(target!=='audio')window.ArtistWaveStudioHost?.pauseMain?.();
    if(target==='youtube')window.ArtistWaveStudio?.stop?.();
    mode=target;
    document.body.dataset.mode=target;
    $('studioWorkspace').hidden=target!=='studio';
    const entertainment=target==='audio';
    for(const id of ['discoverSection','playlistSection','artistWaveHero']){
      $(id).hidden=!entertainment;
    }
    if(entertainment){
      window.ArtistWaveStudioHost?.render?.();
    }
    for(const [name,tab] of Object.entries(tabs)){
      tab.classList.toggle('active',name===target);
      if(name===target)tab.setAttribute('aria-current','page');
      else tab.removeAttribute('aria-current');
    }
    const locationName=$('locationName');
    if(locationName)locationName.textContent=target==='youtube'?'YouTube':target==='audio'?'Discover':'Showdance Studio';
    // Switching workspaces must never inherit scroll position from another
    // workspace. Keep the mode tabs and the new content at the top.
    window.scrollTo({top:0,left:0,behavior:'instant'});
  }
  tabs.audio.addEventListener('click',()=>setMode('audio'));
  tabs.studio.addEventListener('click',()=>setMode('studio'));
  function openWidget(scroll=true){
    if(mode!=='audio')setMode('audio');document.body.classList.add('youtube-widget-open');$('youtubeWorkspace').hidden=false;
    updateYouTubeAccount();if(scroll)$('youtubeWorkspace').scrollIntoView({behavior:'smooth',block:'start'});
  }
  function closeWidget(){stopVideo();$('youtubeWorkspace').hidden=true;document.body.classList.remove('youtube-widget-open')}
  $('youtubeWidgetClose').addEventListener('click',closeWidget);
  $('youtubeDiscoverSetup').addEventListener('click',()=>{openWidget();$('youtubeApiSetup').open=true;$('youtubeApiKey').focus()});
  $('searchForm').addEventListener('submit',()=>{const query=$('artistInput').value.trim();if(query)void searchYouTubeFromEntertainment(query)});
  $('sourceMode').addEventListener('change',()=>{if($('sourceMode').value==='local'){discoverRequest++;discoverAbort?.abort();discoverAbort=null;$('youtubeDiscover').hidden=true}});
  $('audio').addEventListener('play',()=>{if(frame.getAttribute('src')||window.ArtistWaveMiniHost?.state?.().youtubeUrl)stopVideo()});
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden&&frame.getAttribute('src')){stopVideo();setYouTubeMessage('Video stopped while the player was hidden. Open it again to continue.')}
  });
  $('studioClose').addEventListener('click',()=>setMode('audio'));
  for(const id of ['discoverNav','favoritesNav','recentNav']){
    $(id).addEventListener('click',()=>setMode('audio'));
  }
  $('youtubeLinkForm').addEventListener('submit',event=>{
    event.preventDefault();
    const embed=parseYouTubeUrl($('youtubeUrl').value);
    if(!embed){
      setYouTubeMessage('Paste a valid YouTube video or playlist HTTPS link.',true);
      stopVideo();
      return;
    }
    window.ArtistWaveStudioHost?.pauseMain?.();
    setYouTubeMessage('Video loaded in the official YouTube player. Some videos do not allow embedding.');
    loadVideo(embed);
  });
  $('youtubeSearchForm').addEventListener('submit',event=>{
    event.preventDefault();
    const query=$('youtubeSearch').value.trim();
    if(query)searchYouTube(query);
  });
  $('youtubeApiKey').value=readYouTubeApiKey();
  $('youtubeApiSave').addEventListener('click',()=>{
    const key=$('youtubeApiKey').value.trim();
    const saved=writeYouTubeApiKey(key);
    setYouTubeMessage(key?(saved?'YouTube API key saved in this browser. Search for a video.':'Browser storage is unavailable. The key will work for this session only.'):'Saved YouTube API key removed.');
  });
  $('youtubeMiniPlayer').addEventListener('click',()=>window.ArtistWaveMiniHost?.open());
  window.ArtistWaveNavigation={setMode,parseYouTubeUrl,updateYouTubeAccount,takeVideo,restoreVideo};
  window.ArtistWaveYouTubeWidget={open:openWidget,close:closeWidget};
  document.body.dataset.mode='audio';
  updateYouTubeAccount();
})();
