import { app, BrowserWindow, ipcMain, screen } from 'electron';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DeviceService } from '../../core/services/DeviceService';
import { PortScanner } from '../../core/scanner/PortScanner';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { LocalNetworkInfo, NetworkAdapterDetail, WindowState } from '../../shared/types';

const execFileAsync = promisify(execFile);
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels';
import log from '../../core/logger';

let mainWindow: BrowserWindow | null = null;

const isDevelopment = !app.isPackaged;
const deviceService = new DeviceService();
const portScanner = new PortScanner();
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
  window.webContents.send(IPC_CHANNELS.WINDOW_STATE_CHANGED, getWindowState(window));
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
    window.webContents.send(IPC_CHANNELS.APP_STATUS_CHANGED, 'ready');
    log.info('[Main] Estado de la app notificado al renderer: ready');
  });

  const rendererUrl = process.env['ELECTRON_RENDERER_URL'];
  if (rendererUrl) {
    void window.loadURL(rendererUrl);
  } else {
    void window.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  return window;
}

function assertAllowedSender(event: Electron.IpcMainInvokeEvent, channel: string): void {
  if (event.sender !== mainWindow?.webContents) {
    log.warn(`[Main] Mensaje IPC rechazado en canal '${channel}' — origen no autorizado`);
    throw new Error('Origen no autorizado');
  }
}

function getLocalNetworkInfo(): LocalNetworkInfo {
  const hostname = os.hostname();
  const interfaces = os.networkInterfaces();

  for (const [name, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) {
        return {
          hostname,
          ip: addr.address,
          mac: addr.mac,
          interfaceName: name,
          subnet: addr.netmask
        };
      }
    }
  }

  return { hostname, ip: 'No disponible', mac: 'No disponible', interfaceName: 'No disponible', subnet: 'No disponible' };
}

async function getNetworkAdapterDetail(interfaceName: string): Promise<NetworkAdapterDetail> {
  const detail: NetworkAdapterDetail = {
    gateway: 'No disponible',
    dns: [],
    dhcp: false,
    description: interfaceName
  };

  try {
    // ipconfig /all para gateway, DNS, DHCP y descripción
    const { stdout: ipconfigOut } = await execFileAsync('ipconfig', ['/all'], { encoding: 'utf8' });
    const blocks = ipconfigOut.split(/\r?\n\r?\n/);

    for (const block of blocks) {
      // Buscar el bloque que corresponde al adaptador por nombre
      if (!block.toLowerCase().includes(interfaceName.toLowerCase())) continue;

      const field = (pattern: RegExp): string => {
        const m = block.match(pattern);
        return m ? m[1].trim().replace(/\s+/g, ' ') : '';
      };

      const desc = field(/Descripci[oó]n[.\s]*:\s*(.+)/i) || field(/Description[.\s]*:\s*(.+)/i);
      if (desc) detail.description = desc;

      const gw = field(/Puerta de enlace predeterminada[.\s]*:\s*([\d.]+)/i) ||
                 field(/Default Gateway[.\s]*:\s*([\d.]+)/i);
      if (gw) detail.gateway = gw;

      const dhcpVal = field(/DHCP habilitado[.\s]*:\s*(\S+)/i) || field(/DHCP Enabled[.\s]*:\s*(\S+)/i);
      detail.dhcp = /s[ií]/i.test(dhcpVal) || /yes/i.test(dhcpVal);

      // DNS: puede haber múltiples líneas — buscar todas las IPs en líneas de DNS
      const dnsMatch = block.match(/Servidores DNS[.\s]*:(.+?)(?=\r?\n\s*\w|\r?\n\r?\n|$)/is) ||
                       block.match(/DNS Servers[.\s]*:(.+?)(?=\r?\n\s*\w|\r?\n\r?\n|$)/is);
      if (dnsMatch) {
        detail.dns = [...dnsMatch[1].matchAll(/\b(\d{1,3}(?:\.\d{1,3}){3})\b/g)].map(m => m[1]);
      }

      break;
    }
  } catch {
    // Silenciar errores de ipconfig
  }

  // Intentar netsh wlan para datos WiFi
  try {
    const { stdout: wlanOut } = await execFileAsync('netsh', ['wlan', 'show', 'interfaces'], { encoding: 'utf8' });
    const blocks = wlanOut.split(/\r?\n\s*\r?\n/);

    for (const block of blocks) {
      if (!block.toLowerCase().includes(interfaceName.toLowerCase())) continue;

      const wfield = (pattern: RegExp): string => {
        const m = block.match(pattern);
        return m ? m[1].trim() : '';
      };

      const ssid = wfield(/^\s+SSID\s*:\s*(.+)$/im);
      if (ssid) detail.ssid = ssid;

      const signal = wfield(/Se[ñn]al\s*:\s*(\d+)%/i) || wfield(/Signal\s*:\s*(\d+)%/i);
      if (signal) detail.signal = parseInt(signal, 10);

      const radio = wfield(/Tipo de radio\s*:\s*(.+)/i) || wfield(/Radio type\s*:\s*(.+)/i);
      if (radio) detail.radioType = radio;

      const channel = wfield(/Canal\s*:\s*(\S+)/i) || wfield(/Channel\s*:\s*(\S+)/i);
      if (channel) detail.channel = channel;

      const auth = wfield(/Autenticaci[oó]n\s*:\s*(.+)/i) || wfield(/Authentication\s*:\s*(.+)/i);
      if (auth) detail.authentication = auth;

      break;
    }
  } catch {
    // Si netsh falla (adaptador cableado o sin WiFi) se ignora
  }

  return detail;
}

function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.GET_LOCAL_NETWORK_INFO, (event) => {
    assertAllowedSender(event, IPC_CHANNELS.GET_LOCAL_NETWORK_INFO);
    return getLocalNetworkInfo();
  });

  ipcMain.handle(IPC_CHANNELS.GET_NETWORK_ADAPTER_DETAIL, async (event, interfaceName: string) => {
    assertAllowedSender(event, IPC_CHANNELS.GET_NETWORK_ADAPTER_DETAIL);
    return getNetworkAdapterDetail(interfaceName);
  });

  ipcMain.handle(IPC_CHANNELS.GET_LOCAL_OPEN_PORTS, async (event, ip: string) => {
    assertAllowedSender(event, IPC_CHANNELS.GET_LOCAL_OPEN_PORTS);
    const [result] = await portScanner.scanDevices([{ ip, activo: true }]);
    return result?.openPorts ?? [];
  });

  ipcMain.handle(IPC_CHANNELS.SCAN_DEVICES, async (event) => {
    assertAllowedSender(event, IPC_CHANNELS.SCAN_DEVICES);
    try {
      return await deviceService.scanAndDetect();
    } catch (error) {
      log.error('[Main] Error durante el escaneo de dispositivos', error);
      const message = error instanceof Error ? error.message : 'Error desconocido al escanear dispositivos.';
      throw new Error(`No se pudo ejecutar el escaneo de dispositivos: ${message}`);
    }
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_MINIMIZE, (event) => {
    assertAllowedSender(event, IPC_CHANNELS.WINDOW_MINIMIZE);
    BrowserWindow.fromWebContents(event.sender)?.minimize();
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_TOGGLE_MAXIMIZE, (event) => {
    assertAllowedSender(event, IPC_CHANNELS.WINDOW_TOGGLE_MAXIMIZE);
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

  ipcMain.handle(IPC_CHANNELS.WINDOW_CLOSE, (event) => {
    assertAllowedSender(event, IPC_CHANNELS.WINDOW_CLOSE);
    BrowserWindow.fromWebContents(event.sender)?.close();
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_GET_STATE, (event) => {
    assertAllowedSender(event, IPC_CHANNELS.WINDOW_GET_STATE);
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
