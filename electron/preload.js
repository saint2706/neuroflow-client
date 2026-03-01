import { contextBridge, ipcRenderer } from 'electron';

console.log('Preload script running');

try {
  contextBridge.exposeInMainWorld('app', {
    version: '1.0.0',
    saveProject: (content) => ipcRenderer.invoke('save-project', content),
    loadProject: () => ipcRenderer.invoke('load-project'),
  });
  console.log('ContextBridge exposed app successfully');
} catch (error) {
  console.error('Failed to expose context bridge:', error);
}
