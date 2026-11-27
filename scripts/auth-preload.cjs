const { contextBridge, ipcRenderer } = require('electron')

if (process.isMainFrame && location.origin === 'https://acsdd.github.io' &&
    location.pathname.startsWith('/ArtistWave/')) {
  contextBridge.exposeInMainWorld('AudioWaveDesktop', { folderPicker: 'file-input' })
  contextBridge.exposeInMainWorld('AudioWaveOutputs', { list: () => ipcRenderer.invoke('audiowave:outputs:list') })
  contextBridge.exposeInMainWorld('AudioWaveAuth', {
    signIn: () => ipcRenderer.invoke('audiowave:auth:sign-in'),
    cancel: () => ipcRenderer.invoke('audiowave:auth:cancel'),
    restore: () => ipcRenderer.invoke('audiowave:auth:restore'),
    forget: () => ipcRenderer.invoke('audiowave:auth:forget')
  })
  contextBridge.exposeInMainWorld('AudioWaveCcMixter', {
    search: artist => ipcRenderer.invoke('audiowave:ccmixter:search', artist)
  })
  contextBridge.exposeInMainWorld('AudioWaveNavidrome', {
    status: () => ipcRenderer.invoke('audiowave:navidrome:status'),
    cancel: () => ipcRenderer.invoke('audiowave:navidrome:cancel'),
    connect: input => ipcRenderer.invoke('audiowave:navidrome:connect', input),
    disconnect: () => ipcRenderer.invoke('audiowave:navidrome:disconnect'),
    albums: input => ipcRenderer.invoke('audiowave:navidrome:albums', input),
    tracks: id => ipcRenderer.invoke('audiowave:navidrome:tracks', id)
  })
  contextBridge.exposeInMainWorld('AudioWavePlex', {
    status: () => ipcRenderer.invoke('audiowave:plex:status'),
    connect: input => ipcRenderer.invoke('audiowave:plex:connect', input),
    cancel: () => ipcRenderer.invoke('audiowave:plex:cancel'),
    disconnect: () => ipcRenderer.invoke('audiowave:plex:disconnect'),
    albums: input => ipcRenderer.invoke('audiowave:plex:albums', input),
    tracks: id => ipcRenderer.invoke('audiowave:plex:tracks', id)
  })
}
