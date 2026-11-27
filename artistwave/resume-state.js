'use strict';
/* Resume storage contains identifiers only. Resolving a reference never loads media. */
(function(root){
  const sources=['local','navidrome','plex','youtube'];
  const stable=id=>typeof id==='string'&&id.length<=300&&/^(local:[a-f0-9]{64}|navidrome:[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+|plex:[a-zA-Z0-9_-]+:\d+|youtube:[a-zA-Z0-9_-]{11})$/.test(id);
  function identifier(track){
    if(track?.source==='LOCAL'&&/^[a-f0-9]{64}$/.test(track.localKey||''))return 'local:'+track.localKey;
    const id=String(track?.id||'');
    return stable(id)&&id.startsWith(String(track.source).toLowerCase()+':')?id:null;
  }
  function validateSnapshot(value){
    if(!value||value.version!==1||!sources.includes(value.source)||!stable(value.trackId)||!value.trackId.startsWith(value.source+':')||
      !Array.isArray(value.queueIds)||!value.queueIds.length||value.queueIds.length>500||!value.queueIds.every(stable)||
      !Number.isInteger(value.queueIndex)||value.queueIndex<0||value.queueIndex>=value.queueIds.length||value.queueIds[value.queueIndex]!==value.trackId||
      !Number.isFinite(value.positionSeconds)||value.positionSeconds<0||value.positionSeconds>604800)return null;
    return {version:1,source:value.source,trackId:value.trackId,queueIds:[...value.queueIds],queueIndex:value.queueIndex,positionSeconds:value.positionSeconds};
  }
  function serializeSnapshot(state){const valid=validateSnapshot(state);return valid?JSON.stringify(valid):null}
  function resolveSnapshot(value,available=[],connections={}){
    const saved=validateSnapshot(value);if(!saved)return null;
    const find=id=>available.find(track=>{
      if(identifier(track)!==id)return false;
      if(['NAVIDROME','PLEX'].includes(track.source)){
        const connection=connections[track.source];return connection?.connected&&id.split(':')[1]===connection.id;
      }
      return track.source!=='LOCAL'||Boolean(track.url)&&!track.unavailable;
    });
    const current=find(saved.trackId);if(!current)return null;
    const tracks=saved.queueIds.map(find).filter(Boolean);
    const duration=Number(current.duration);
    return {tracks,selected:tracks.indexOf(current),positionSeconds:Number.isFinite(duration)&&duration>=0?Math.min(saved.positionSeconds,duration):saved.positionSeconds,paused:true,skipped:saved.queueIds.length-tracks.length};
  }
  root.ArtistWaveResumeState={identifier,validateSnapshot,serializeSnapshot,resolveSnapshot};
})(typeof window==='undefined'?globalThis:window);
