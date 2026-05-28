// ============================================================
// EXPENSE//DIARY — Preload (context bridge)
// ============================================================
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  loadData:    ()           => ipcRenderer.invoke('load-data'),
  saveData:    (data)       => ipcRenderer.invoke('save-data', data),
  exportCSV:   (csv)        => ipcRenderer.invoke('export-csv', csv),
  getDataPath: ()           => ipcRenderer.invoke('get-data-path'),
});
