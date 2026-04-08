import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { NetworkMonitorService } from '../../core/network/services/network-monitor.service';

let mainWindow: BrowserWindow | null = null;

const isDevelopment = !app.isPackaged;

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

async function bootstrap(): Promise<void> {
  const networkMonitor = new NetworkMonitorService();
  networkMonitor.initialize();

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
