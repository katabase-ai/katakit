const { app, BrowserWindow } = require('electron');
const path = require('node:path');

const createWindow = () => {
  const window = new BrowserWindow({
    width: 820,
    height: 650,
    minWidth: 520,
    minHeight: 460,
    title: 'Katakit Electron starter',
    backgroundColor: '#f7f5ef',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  void window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
};

const start = async () => {
  await app.whenReady();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
};

void start();

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
