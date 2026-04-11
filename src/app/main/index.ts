import { app, BrowserWindow, ipcMain, screen } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { DeviceService } from '../../core/services/DeviceService';
import type { WindowState } from '../../shared/types';
import log from '../../core/logger';

let mainWindow: BrowserWindow | null = null;

const isDevelopment = !app.isPackaged;
const deviceService = new DeviceService();
const windowStateVersion = 3;
const defaultWindowBounds = {
  width: 860,
  height: 600
};
const windowStateFilePath = path.join(app.getPath('userData'), 'window-state.json');

interface PersistedWindowState {
  version: number;
  x?: number;
  y?: number;
  width: number;
  height: number;
  isMaximized: boolean;
}

function sanitizeDimension(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max) {
    return value;
  }
  return fallback;
}

function sanitizeCoordinate(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value >= -32000 && value <= 32000) {
    return value;
  }
  return undefined;
}

function readWindowState(): PersistedWindowState {
  try {
    if (!fs.existsSync(windowStateFilePath)) {
      return {
        version: windowStateVersion,
        ...defaultWindowBounds,
        isMaximized: false
      };
    }

    const content = fs.readFileSync(windowStateFilePath, 'utf-8');
    const parsed = JSON.parse(content) as Partial<PersistedWindowState>;

    if (parsed.version !== windowStateVersion) {
      return {
        version: windowStateVersion,
        ...defaultWindowBounds,
        isMaximized: false
      };
    }

    return {
      version: windowStateVersion,
      width: sanitizeDimension(parsed.width, defaultWindowBounds.width, 100, 32000),
      height: sanitizeDimension(parsed.height, defaultWindowBounds.height, 100, 32000),
      x: sanitizeCoordinate(parsed.x),
      y: sanitizeCoordinate(parsed.y),
      isMaximized: typeof parsed.isMaximized === 'boolean' ? parsed.isMaximized : false
    };
  } catch {
    return {
      version: windowStateVersion,
      ...defaultWindowBounds,
      isMaximized: false
    };
  }
}

function isBoundsVisible(state: PersistedWindowState): boolean {
  if (typeof state.x !== 'number' || typeof state.y !== 'number') {
    return false;
  }

  const { x, y, width, height } = state;
  const displays = screen.getAllDisplays();

  return displays.some(({ workArea }) => {
    const right = x + width;
    const bottom = y + height;

    return (
      right > workArea.x &&
      x < workArea.x + workArea.width &&
      bottom > workArea.y &&
      y < workArea.y + workArea.height
    );
  });
}

function saveWindowState(window: BrowserWindow): void {
  try {
    const bounds = window.isMaximized() ? window.getNormalBounds() : window.getBounds();
    const state: PersistedWindowState = {
      version: windowStateVersion,
      ...bounds,
      isMaximized: window.isMaximized()
    };

    fs.mkdirSync(path.dirname(windowStateFilePath), { recursive: true });
    fs.writeFileSync(windowStateFilePath, JSON.stringify(state, null, 2), 'utf-8');
  } catch {
    // Ignora errores de persistencia para no afectar el ciclo de vida de la ventana.
  }
}

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
  window.on('resized', () => saveWindowState(window));
  window.on('moved', () => saveWindowState(window));
  window.on('close', () => saveWindowState(window));
}

function createMainWindow(): BrowserWindow {
  const persistedState = readWindowState();
  const hasVisibleBounds = isBoundsVisible(persistedState);
  const window = new BrowserWindow({
    width: persistedState.width,
    height: persistedState.height,
    x: hasVisibleBounds ? persistedState.x : undefined,
    y: hasVisibleBounds ? persistedState.y : undefined,
    minWidth: 750,
    minHeight: 600,
    center: !hasVisibleBounds,
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
    if (persistedState.isMaximized) {
      window.maximize();
    }

    window.show();
    notifyWindowState(window);
    window.webContents.send('app-status-changed', 'ready');
    log.info('[Main] Estado de la app notificado al renderer: ready');
  });

  if (isDevelopment) {
    void window.loadURL('http://127.0.0.1:5173');
  } else {
    void window.loadFile(path.join(__dirname, '../../renderer/index.html'));
  }

  return window;
}

function assertAllowedSender(event: Electron.IpcMainInvokeEvent, channel: string): void {
  if (event.sender !== mainWindow?.webContents) {
    log.warn(`[Main] Mensaje IPC rechazado en canal '${channel}' — origen no autorizado`);
    throw new Error('Origen no autorizado');
  }
}

function registerIpcHandlers(): void {
  ipcMain.handle('scan-devices', async (event) => {
    assertAllowedSender(event, 'scan-devices');
    try {
      return await deviceService.scanAndDetect();
    } catch (error) {
      log.error('[Main] Error durante el escaneo de dispositivos', error);
      const message = error instanceof Error ? error.message : 'Error desconocido al escanear dispositivos.';
      throw new Error(`No se pudo ejecutar el escaneo de dispositivos: ${message}`);
    }
  });

  ipcMain.handle('window:minimize', (event) => {
    assertAllowedSender(event, 'window:minimize');
    BrowserWindow.fromWebContents(event.sender)?.minimize();
  });

  ipcMain.handle('window:toggle-maximize', (event) => {
    assertAllowedSender(event, 'window:toggle-maximize');
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
    assertAllowedSender(event, 'window:close');
    BrowserWindow.fromWebContents(event.sender)?.close();
  });

  ipcMain.handle('window:get-state', (event) => {
    assertAllowedSender(event, 'window:get-state');
    const window = BrowserWindow.fromWebContents(event.sender);

    if (!window) {
      return { isMaximized: false } satisfies WindowState;
    }

    return getWindowState(window);
  });
}

async function bootstrap(): Promise<void> {
  registerIpcHandlers();

  mainWindow = createMainWindow();
}

app.whenReady().then(async () => {
  log.info(`[Main] Aplicación iniciada — versión ${app.getVersion()} | entorno: ${isDevelopment ? 'desarrollo' : 'producción'}`);
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
