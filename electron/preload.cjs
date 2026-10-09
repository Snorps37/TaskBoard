const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  load: () => ipcRenderer.invoke('db:load'),
  save: (json) => ipcRenderer.invoke('db:save', json),
  loadSettings: () => ipcRenderer.invoke('settings:load'),
  saveSettings: (json) => ipcRenderer.invoke('settings:save', json),
  fetchIcs: (url) => ipcRenderer.invoke('ics:fetch', url),
  readClipboard: () => ipcRenderer.invoke('clipboard:read')
});
