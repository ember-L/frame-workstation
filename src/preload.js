const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('frame', {
  openVideo: () => ipcRenderer.invoke('open-video'),
  exportVideo: options => ipcRenderer.invoke('export-video', options),
  generateDubbing: options => ipcRenderer.invoke('generate-dubbing', options),
  transcribeVideo: options => ipcRenderer.invoke('transcribe-video', options),
  importSubtitles: () => ipcRenderer.invoke('import-subtitles'),
  saveSubtitles: cues => ipcRenderer.invoke('save-subtitles', cues),
});
