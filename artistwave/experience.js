'use strict';
/* Local presentation preferences and lightweight, accessible feedback. */
(function(){
  const $=id=>document.getElementById(id);
  const read=(key,fallback)=>{try{return localStorage.getItem(key)||fallback}catch{return fallback}};
  const write=(key,value)=>{try{localStorage.setItem(key,value)}catch{}};
  const palettes={night:['#101922','#b7f56b'],day:['#fffefa','#376b3a'],'bright-night':['#303f4a','#c6f28c'],ocean:['#173747','#7fe5ec'],plum:['#3a2a44','#f0baf5'],bugs:['#485762','#ffad55'],daffy:['#343d47','#ffb258'],tweety:['#514822','#ffdf5c'],sylvester:['#3b3d44','#ff8c94'],taz:['#503b2d','#f5ad6d'],roadrunner:['#1e4560','#83dfff']};
  const preview=$('themePreviews'),select=$('themeSelect');
  if(preview&&select){
    for(const option of select.querySelectorAll('option')){
      const palette=palettes[option.value];if(!palette)continue;
      const button=document.createElement('button');button.type='button';button.className='theme-preview';button.dataset.themeChoice=option.value;
      const swatch=document.createElement('span');swatch.className='theme-preview-swatch';swatch.style.background=palette[0];swatch.style.color=palette[1];swatch.setAttribute('aria-hidden','true');swatch.textContent='●';
      const name=document.createElement('span');name.textContent=option.textContent;button.append(swatch,name);
      button.onclick=()=>window.ArtistWaveTheme?.applyTheme(option.value,true);preview.append(button);
    }
    const sync=()=>preview.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.themeChoice===document.documentElement.dataset.theme)));
    new MutationObserver(sync).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});sync();
  }
  const appearance=$('appearanceMenu');
  if(appearance){
    appearance.addEventListener('keydown',event=>{
      if(event.key==='Escape'&&appearance.open&&!event.defaultPrevented){event.preventDefault();event.stopPropagation();appearance.open=false;appearance.querySelector('summary')?.focus()}
    });
    document.addEventListener('pointerdown',event=>{if(appearance.open&&!appearance.contains(event.target))appearance.open=false});
  }
  function preference(id,key,allowed,fallback,attribute){
    const control=$(id);if(!control)return;
    const saved=read(key,fallback),value=allowed.includes(saved)?saved:fallback;
    control.value=value;document.documentElement.dataset[attribute]=value;
    control.addEventListener('change',()=>{const next=allowed.includes(control.value)?control.value:fallback;document.documentElement.dataset[attribute]=next;write(key,next)});
  }
  preference('displayDensity','artistwave:display-density',['comfortable','compact'],'comfortable','density');
  preference('glassIntensity','artistwave:glass-intensity',['soft','medium','strong'],'medium','glass');
  const guide=$('gettingStarted');
  if(guide){guide.hidden=read('artistwave:guide-dismissed','')==='yes';$('dismissGettingStarted')?.addEventListener('click',()=>{guide.hidden=true;write('artistwave:guide-dismissed','yes')});$('showGettingStarted')?.addEventListener('click',()=>{guide.hidden=false;guide.scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})})}
  let toastTimer;
  window.ArtistWaveFeedback={show(message){const toast=$('actionToast');if(!toast||!message)return;clearTimeout(toastTimer);toast.textContent=String(message);toast.classList.add('visible');toastTimer=setTimeout(()=>toast.classList.remove('visible'),3500)}};
})();
