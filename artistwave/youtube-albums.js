'use strict';
(function(root){
  const normalize=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&amp;/g,' and ').replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
  function videoSong(title,artist){
    let text=String(title||'').replace(/\([^)]*(?:official|video|audio|lyrics?|visuali[sz]er)[^)]*\)|\[[^\]]*(?:official|video|audio|lyrics?|visuali[sz]er)[^\]]*\]/ig,' ');
    text=normalize(text);const name=normalize(artist);
    if(name&&text.startsWith(name+' '))text=text.slice(name.length).trim();
    else if(name&&text.endsWith(' '+name))text=text.slice(0,-name.length).trim();
    return text.replace(/\b(?:official music video|official video|official audio|lyric video|lyrics|audio)\b/g,' ').replace(/\s+/g,' ').trim();
  }
  function matches(tracks,artist){
    const name=normalize(artist),bySong=new Map();
    for(const track of tracks||[]){
      if(normalize(track.artistName)!==name||!track.trackName||!track.collectionName)continue;
      const song=normalize(track.trackName);if(!song)continue;
      const old=bySong.get(song),date=track.releaseDate||'';
      if(!old||(date&&(!old.releaseDate||date<old.releaseDate)))bySong.set(song,track);
    }
    return bySong;
  }
  function group(videos,tracks,artist){
    const bySong=matches(tracks,artist),groups=new Map();
    for(const video of videos||[]){const song=videoSong(video.snippet?.title,artist);const album=bySong.get(song)?.collectionName||'Other videos';if(!groups.has(album))groups.set(album,[]);groups.get(album).push(video)}
    return [...groups].sort(([a],[b])=>a==='Other videos'?1:b==='Other videos'?-1:a.localeCompare(b)).map(([album,items])=>({album,items}));
  }
  function toTracks(videos,tracks,artist){
    const bySong=matches(tracks,artist),result=[];
    for(const video of videos||[]){
      const id=video.id?.videoId,track=bySong.get(videoSong(video.snippet?.title,artist));
      if(!track||!/^[A-Za-z0-9_-]{11}$/.test(id||''))continue;
      result.push({id:'youtube:'+id,title:track.trackName,artist:track.artistName,collection:track.collectionName,albumKind:'album',year:String(track.releaseDate||'').slice(0,4),trackNumber:track.trackNumber||0,source:'YOUTUBE',url:'https://www.youtube.com/embed/'+id,sourceUrl:'https://www.youtube.com/watch?v='+id});
    }
    return result;
  }
  const api={group,toTracks,videoSong};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ArtistWaveYouTubeAlbums=api;
})(globalThis);
