const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  load: () => ipcRenderer.invoke('db:load'),
  save: (json) => ipcRenderer.invoke('db:save', json),
  loadSettings: () => ipcRenderer.invoke('settings:load'),
  saveSettings: (json) => ipcRenderer.invoke('settings:save', json),
  fetchIcs: (url) => ipcRenderer.invoke('ics:fetch', url),
  platform: process.platform,
  showWindow: () => ipcRenderer.invoke('win:show'),
  setKeepInTray: (value) => ipcRenderer.invoke('app:keepInTray', value),
  setOpenAtLogin: (value) => ipcRenderer.invoke('app:openAtLogin', value),
  updateStatus: () => ipcRenderer.invoke('update:status'),
  checkForUpdates: (auto) => ipcRenderer.invoke('update:check', auto),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  onUpdateStatus: (fn) => ipcRenderer.on('update:status', (_event, status) => fn(status))
});
