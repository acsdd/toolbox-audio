'use strict';
(function(root){
  function create(){
    let state={mode:'full',source:null,trackId:null,queueIndex:-1,playing:false,transitionId:0};
    return {
      select(value){state={...state,...value,transitionId:state.transitionId+1};return state.transitionId},
      transition(mode){if(!['full','mini'].includes(mode))throw new Error('Unknown playback mode');state={...state,mode,transitionId:state.transitionId+1};return state.transitionId},
      complete(id){return id===state.transitionId},
      accept(id,trackId){return id===state.transitionId&&trackId===state.trackId},
      snapshot(){return {...state}}
    };
  }
  root.ArtistWavePlaybackState={create};
})(typeof window==='undefined'?globalThis:window);
