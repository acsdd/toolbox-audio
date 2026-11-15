'use strict';
/* Three separate listening workspaces. The YouTube view uses only YouTube's
 * official visible embedded player; never fetches or extracts audio streams. */
(function(){
  const $=id=>document.getElementById(id);
  const tabs={audio:$('modeAudio'),studio:$('studioNav'),youtube:$('modeYoutube')};
  const frame=$('youtubeFrame');
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
    frame.removeAttribute('src');
    $('youtubePlayerRegion').hidden=true;
  }
  function setYouTubeMessage(message,isError=false){
    $('youtubeMessage').textContent=message;
    $('youtubeMessage').classList.toggle('error',isError);
  }
  function renderYouTubeResults(items){
    const results=$('youtubeSearchResults');
    results.replaceChildren();
    for(const item of items){
      const video=item.id?.videoId;
      const snippet=item.snippet;
      if(!video||!snippet)continue;
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
        frame.src='https://www.youtube.com/embed/'+encodeURIComponent(video);
        $('youtubePlayerRegion').hidden=false;
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
      const params=new URLSearchParams({part:'snippet',type:'video',maxResults:'12',q:query,key});
      const response=await fetch('https://www.googleapis.com/youtube/v3/search?'+params);
      const data=await response.json();
      if(!response.ok)throw new Error(data.error?.message||'YouTube search could not be completed.');
      renderYouTubeResults(data.items||[]);
      setYouTubeMessage(data.items?.length?'Choose a video to play it here.':'No videos found. Try another search.');
    }catch(error){setYouTubeMessage(error.message||'YouTube search failed. Check the API key and try again.',true)}
  }
  function setMode(target){
    if(!tabs[target])return;
    // A single handler owns workspace visibility. Never rely on the previous
    // mode: an account action, sidebar link or a direct Studio close may have
    // altered visibility without changing the navigation's previous mode.
    if(target==='studio'){
      window.ArtistWaveStudio?.open();
    }else{
      window.ArtistWaveStudio?.close();
    }
    if(target!=='youtube')stopVideo();
    if(target!=='audio')window.ArtistWaveStudioHost?.pauseMain?.();
    if(target==='youtube')window.ArtistWaveStudio?.stop?.();
    mode=target;
    document.body.dataset.mode=target;
    $('studioWorkspace').hidden=target!=='studio';
    $('youtubeWorkspace').hidden=target!=='youtube';
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
    if(target==='youtube'){updateYouTubeAccount();$('locationName').textContent='YouTube';}
    else if(target==='audio')$('locationName').textContent='Discover';
    else $('locationName').textContent='Showdance Studio';
    // Switching workspaces must never inherit scroll position from another
    // workspace. Keep the mode tabs and the new content at the top.
    window.scrollTo({top:0,left:0,behavior:'instant'});
  }
  tabs.audio.addEventListener('click',()=>setMode('audio'));
  tabs.studio.addEventListener('click',()=>setMode('studio'));
  tabs.youtube.addEventListener('click',()=>setMode('youtube'));
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
    frame.src=embed;
    $('youtubePlayerRegion').hidden=false;
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
  window.ArtistWaveNavigation={setMode,parseYouTubeUrl,updateYouTubeAccount};
  document.body.dataset.mode='audio';
  updateYouTubeAccount();
})();
