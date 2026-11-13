'use strict'
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('audioWaveWidgets', Object.freeze({
  list: () => ipcRenderer.invoke('audiowave:widgets:list'),
  install: (id) => ipcRenderer.invoke('audiowave:widgets:install', id),
  uninstall: (id) => ipcRenderer.invoke('audiowave:widgets:uninstall', id),
  open: (id) => ipcRenderer.invoke('audiowave:widgets:open', id)
}))