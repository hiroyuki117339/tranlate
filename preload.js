const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onTranscriptionData: (callback) => ipcRenderer.on('transcription-data', callback)
});
