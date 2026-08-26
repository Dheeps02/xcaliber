import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import { writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';

if (process.platform === 'win32') {
  // Chrome 147 uses ANGLE D3D11 successfully on this Intel Iris Xe driver.
  // Electron 42 (Chromium 134) crashes the GPU process via the default EGL
  // init path, but explicitly requesting d3d11 + bypassing the blocklist
  // matches Chrome's working config. Fall back to d3d11on12 if this regresses.
  app.commandLine.appendSwitch('use-angle', 'd3d11');
  app.commandLine.appendSwitch('ignore-gpu-blocklist');
}

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
  const ext = process.platform === 'win32' ? '.exe' : '';
  const bin = isDev
    ? join(__dirname, `../target/debug/zenscope${ext}`)
    : join(process.resourcesPath, `zenscope${ext}`);

  try {
    // 'pipe' stdin + windowsHide avoids spawning a visible console window on
    // Windows. Keeping the backend's stdin pipe open also ties its lifetime
    // to ours: when this process dies (even via a forced kill), the OS
    // closes our end of the pipe, the backend sees EOF on stdin, and exits.
    backend = spawn(bin, [], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    backend.stdout?.on('data', (d) => { try { process.stdout.write(d); } catch {} });
    backend.stderr?.on('data', (d) => { try { process.stderr.write(d); } catch {} });
    backend.on('error', (e) => console.warn('[backend] failed to start:', e.message));
    backend.on('exit', (code) => {
      // 0xC0000135 = STATUS_DLL_NOT_FOUND — Packet.dll / wpcap.dll not alongside exe
      if (code === 3221225781) {
        dialog.showMessageBoxSync({
          type: 'error',
          title: 'Missing DLLs — Npcap required',
          message: 'Packet.dll or wpcap.dll could not be found.',
          detail:
            'Install Npcap from https://npcap.com and relaunch ZenScope, or place Packet.dll and wpcap.dll in the same folder as the executable.',
          buttons: ['OK'],
        });
        app.quit();
      }
    });
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
    mainWindow.webContents.on('before-input-event', (_e, input) => {
      if (input.key === 'F12' && input.type === 'keyDown') {
        mainWindow?.webContents.openDevTools({ mode: 'detach' });
      }
    });
  }

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(join(__dirname, '../frontend/dist/index.html'));
  }
}

app.whenReady().then(() => {
  if (
    process.platform === 'win32' &&
    !existsSync('C:\\Windows\\System32\\Npcap\\Packet.dll') &&
    !existsSync('C:\\Windows\\System32\\Packet.dll')
  ) {
    dialog.showMessageBoxSync({
      type: 'error',
      title: 'Npcap not found',
      message: 'Npcap is required for Ethernet transport on Windows.',
      detail: 'Download and install it from https://npcap.com, then relaunch ZenScope.',
      buttons: ['OK'],
    });
    app.quit();
    return;
  }

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
