const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('karmaOverlay', {
  setInteractive: (interactive) => {
    ipcRenderer.send('overlay:set-interactive', Boolean(interactive));
  },
  requestStop: (reason = 'button_clicked') => {
    ipcRenderer.send('overlay:request-stop', reason);
  },
  onStatusUpdate: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('overlay:update-status', handler);
    return () => ipcRenderer.removeListener('overlay:update-status', handler);
  },
  close: () => {
    ipcRenderer.send('overlay:close');
  },
});
