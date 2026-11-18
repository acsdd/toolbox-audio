'use strict';
(function(root){
  const norm=value=>String(value||'').normalize('NFKC').trim().toLowerCase();
  function identity(t){
    if(t.source==='LOCAL')return 'LOCAL|'+(t.localKey||[t.artist,t.title,t.collection].map(norm).join('|'));
    return String(t.source)+'|'+(t.url||t.id||[t.artist,t.title,t.collection].map(norm).join('|'));
  }
  function resolve(t,available=[],connections={}){
    if(t.source==='LOCAL'){
      const matches=available.filter(x=>x.source==='LOCAL'&&x.url&&(t.localKey?x.localKey===t.localKey:[x.artist,x.title,x.collection].map(norm).join('|')===[t.artist,t.title,t.collection].map(norm).join('|')));
      const distinct=[...new Map(matches.map(x=>[x.localKey||x.url,x])).values()];
      return distinct.length===1?distinct[0]:null;
    }
    if(['NAVIDROME','PLEX'].includes(t.source)){
      const state=connections[t.source];
      if(!state?.connected||state.error||!state.id)return null;
      try{const u=new URL(t.url);if(u.origin!=='https://acsdd.github.io'||!u.pathname.startsWith('/ArtistWave/__'+t.source.toLowerCase()+'/'+state.id+'/'))return null}catch{return null}
    }
    return /^https:\/\//.test(t.url||'')?t:null;
  }
  function unique(tracks){const seen=new Set();return tracks.filter(t=>{const key=identity(t);if(seen.has(key))return false;seen.add(key);return true})}
  const api={identity,resolve,unique};
  if(typeof module!=='undefined')module.exports=api;
  root.ArtistWaveLibraryData=api;
})(typeof window==='undefined'?globalThis:window);
