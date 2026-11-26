'use strict';
const OUTPUT_PROBE_URL='https://acsdd.github.io/ArtistWave/__output_probe__.html';
function allowOutputPermission(contents,permission,origin,details,main,probe){
  let trusted=false;try{trusted=new URL(origin).origin==='https://acsdd.github.io'}catch{}
  if(!trusted||details?.isMainFrame!==true)return false;
  if(probe&&!probe.isDestroyed()&&contents===probe.webContents&&details.requestingUrl===OUTPUT_PROBE_URL)
    return permission==='speaker-selection'||(permission==='media'&&details.mediaType==='audio');
  return Boolean(main&&!main.isDestroyed()&&contents===main.webContents&&permission==='speaker-selection'&&
    typeof details.requestingUrl==='string'&&details.requestingUrl.startsWith('https://acsdd.github.io/ArtistWave/'));
}
module.exports={OUTPUT_PROBE_URL,allowOutputPermission};
