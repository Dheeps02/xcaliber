import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  setZoom:         (factor: number)                  => ipcRenderer.invoke('set-zoom', factor),
  saveFile:        (path: string, content: string)   => ipcRenderer.invoke('save-file', path, content),
  getDocumentsDir: ()                                => ipcRenderer.invoke('get-documents-dir'),
  openDirectory:   ()                                => ipcRenderer.invoke('open-directory'),
  revealInFolder:  (path: string)                    => ipcRenderer.invoke('reveal-in-folder', path),
  windowMinimize:  ()                                => ipcRenderer.send('window-minimize'),
  windowMaximize:  ()                                => ipcRenderer.send('window-maximize'),
  windowClose:     ()                                => ipcRenderer.send('window-close'),
});
