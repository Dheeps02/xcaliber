import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';

if (process.platform === 'linux') {
  const platform = process.env.WAYLAND_DISPLAY ? 'wayland' : 'x11';
  app.commandLine.appendSwitch('ozone-platform', platform);
  if (platform === 'wayland') {
    app.commandLine.appendSwitch('enable-features', 'UseOzonePlatform,WaylandWindowDecorations');
  }
}

const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;
let backend: ChildProcess | null = null;

function spawnBackend() {
  const bin = isDev
    ? join(__dirname, '../target/debug/xcp-client')
    : join(process.resourcesPath, 'xcp-client');

  try {
    backend = spawn(bin, ['--server-only'], { stdio: 'inherit' });
    backend.on('error', (e) => console.warn('[backend] failed to start:', e.message));
  } catch (e) {
    console.warn('[backend] not found — run `cargo run -- --server-only` manually');
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 860,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    resizable: true,
    show: false,
    backgroundColor: '#030712',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(join(__dirname, '../frontend/dist/index.html'));
  }
}

app.whenReady().then(() => {
  spawnBackend();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  backend?.kill();
  if (process.platform !== 'darwin') app.quit();
});

// ── IPC ───────────────────────────────────────────────────────────────────────

ipcMain.handle('set-zoom', (_e, factor: number) => {
  mainWindow?.webContents.setZoomFactor(factor);
});

ipcMain.handle('save-file', async (_e, path: string, content: string) => {
  await writeFile(path, content, 'utf-8');
});

ipcMain.handle('get-documents-dir', () => app.getPath('documents'));

ipcMain.handle('open-directory', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });
  return result.canceled ? null : (result.filePaths[0] ?? null);
});

ipcMain.handle('reveal-in-folder', (_e, filePath: string) => {
  shell.showItemInFolder(filePath);
});

ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.on('window-close', () => mainWindow?.close());
