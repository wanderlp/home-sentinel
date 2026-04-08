import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { NetworkMonitorService } from '../../core/network/services/network-monitor.service';
import { DeviceService } from '../../core/services/DeviceService';

let mainWindow: BrowserWindow | null = null;

const isDevelopment = !app.isPackaged;
const deviceService = new DeviceService();

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
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
