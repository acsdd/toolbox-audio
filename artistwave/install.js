'use strict';
/* Progressive enhancement. The install prompt is controlled by the browser. */
(function(){
  const button=document.getElementById('installAppButton');
  const status=document.getElementById('installAppStatus');
  // Keep the install UI available for a future release.
  const installEnabled=false;
  let deferredPrompt=null;
  let statusTimer;
  const installed=()=>window.matchMedia?.('(display-mode: standalone)').matches||
    window.navigator?.standalone===true;
  function message(value){
    if(!installEnabled||!status)return;
    status.textContent=value;
    status.hidden=false;
    clearTimeout(statusTimer);
    statusTimer=setTimeout(()=>{status.hidden=true},6000);
  }
  function update(){
    if(!button)return;
    button.hidden=!installEnabled;
    if(installed()){
      button.textContent='✓ App';
      button.disabled=true;
      button.setAttribute('aria-label','ArtistWave is running as an installed app');
    }else{
      button.disabled=false;
      button.textContent='⬇ Install';
    }
  }
  window.addEventListener('beforeinstallprompt',event=>{
    event.preventDefault();
    deferredPrompt=event;
    update();
  });
  window.addEventListener('appinstalled',()=>{
    deferredPrompt=null;update();
    message('ArtistWave installed. Use its desktop or app launcher shortcut.');
  });
  button?.addEventListener('click',async()=>{
    if(!installEnabled||installed())return;
    if(deferredPrompt){
      const prompt=deferredPrompt;deferredPrompt=null;
      try{
        await prompt.prompt();
        const choice=await prompt.userChoice;
        message(choice?.outcome==='accepted'?'Install requested. Check your app launcher.':'Install cancelled. You can try again using your browser menu.');
      }catch{
        message('Installation was not available. Use your browser menu: Install app.');
      }
    }else{
      message('To install: open the Chrome or Edge menu (⋮) and choose Install ArtistWave / Install this site as an app. On Safari use Add to Dock or Add to Home Screen. Browser support varies.');
    }
  });
  if(!window.AudioWaveAuth&&'serviceWorker' in navigator&&window.isSecureContext!==false){
    window.addEventListener('load',()=>{
      navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(()=>{
        // Installation may still work without an offline shell.
      });
    });
  }
  update();
})();
