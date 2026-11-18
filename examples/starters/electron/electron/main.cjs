const { app, BrowserWindow, protocol, session } = require('electron');
const { extname, resolve, sep } = require('node:path');
const { readFile } = require('node:fs/promises');

// The renderer needs a secure, isolated origin for Moonshine's WASM threads.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'katakit',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
]);
const headers = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Resource-Policy': 'same-origin',
};
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.wasm': 'application/wasm',
};

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
  void window.loadURL('katakit://app/index.html');
};

const start = async () => {
  await app.whenReady();
  protocol.handle('katakit', async request => {
    const url = new URL(request.url);
    const root = resolve(__dirname, '..', 'dist');
    const path = resolve(root, `.${decodeURIComponent(url.pathname)}`);
    if (url.hostname !== 'app' || !path.startsWith(`${root}${sep}`))
      return new Response('Not found', { status: 404, headers });
    try {
      return new Response(await readFile(path), {
        headers: { ...headers, 'Content-Type': types[extname(path)] ?? 'application/octet-stream' },
      });
    } catch (error) {
      if (error.code === 'ENOENT') return new Response('Not found', { status: 404, headers });
      throw error;
    }
  });
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(permission === 'media' && webContents.getURL().startsWith('katakit://app/'));
  });
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
};

void start();

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
