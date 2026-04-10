import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { NetworkMonitorService } from '../../core/network/services/network-monitor.service';
import { DeviceService } from '../../core/services/DeviceService';
import type { WindowState } from '../../shared/types';

let mainWindow: BrowserWindow | null = null;

const isDevelopment = !app.isPackaged;
const deviceService = new DeviceService();

function getWindowState(window: BrowserWindow): WindowState {
  return {
    isMaximized: window.isMaximized()
  };
}

function notifyWindowState(window: BrowserWindow): void {
  window.webContents.send('window-state-changed', getWindowState(window));
}

function registerWindowEvents(window: BrowserWindow): void {
  window.on('maximize', () => notifyWindowState(window));
  window.on('unmaximize', () => notifyWindowState(window));
}

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 960,
    minHeight: 640,
    center: true,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#060f1b',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  registerWindowEvents(window);
  window.once('ready-to-show', () => {
    window.show();
    notifyWindowState(window);
  });

  if (isDevelopment) {
    void window.loadURL('http://127.0.0.1:5173');
  } else {
    void window.loadFile(path.join(__dirname, '../../renderer/index.html'));
  }

  return window;
}

function registerIpcHandlers(): void {
  ipcMain.handle('scan-devices', async () => {
    try {
      return await deviceService.scanAndDetect();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido al escanear dispositivos.';
      throw new Error(`No se pudo ejecutar el escaneo de dispositivos: ${message}`);
    }
  });

  ipcMain.handle('window:minimize', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize();
  });

  ipcMain.handle('window:toggle-maximize', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);

    if (!window) {
      return;
    }

    if (window.isMaximized()) {
      window.unmaximize();
      return;
    }

    window.maximize();
  });

  ipcMain.handle('window:close', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close();
  });

  ipcMain.handle('window:get-state', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);

    if (!window) {
      return { isMaximized: false } satisfies WindowState;
    }

    return getWindowState(window);
  });
}

async function bootstrap(): Promise<void> {
  const networkMonitor = new NetworkMonitorService();
  networkMonitor.initialize();
  registerIpcHandlers();

  mainWindow = createMainWindow();
}

app.whenReady().then(async () => {
  await bootstrap();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
