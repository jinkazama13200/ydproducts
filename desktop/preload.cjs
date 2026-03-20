const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopAPI', {
  getRunningProducts: (cfg) => ipcRenderer.invoke('get-running-products', cfg),
  checkUpdatesNow: () => ipcRenderer.invoke('check-updates-now')
});
