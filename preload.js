const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('konus', {
    getConfig: () => ipcRenderer.invoke('get-config'),
    setConfig: (key, value) => ipcRenderer.invoke('set-config', key, value),
    sendRecordingData: (data) => ipcRenderer.send('recording-data', data),
    onStartRecording: (callback) => ipcRenderer.on('start-recording', callback),
    onStopRecording: (callback) => ipcRenderer.on('stop-recording', callback),
    onCancelRecording: (callback) => ipcRenderer.on('cancel-recording', callback)
});
