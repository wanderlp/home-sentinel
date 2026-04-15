import { contextBridge, ipcRenderer } from 'electron';
import type { AppStatus, HomeSentinelAPI, WindowState } from '../../shared/types';
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels';

// electron-vite bundlea este archivo junto con sus imports locales, por lo que
// IPC_CHANNELS queda incrustado en el bundle del preload — no hay require() externo
// en runtime y el sandbox de Electron no causa problemas.

function createIpcListener<T>(channel: string, callback: (data: T) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, data: T) => callback(data);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

const api: HomeSentinelAPI = {
  scanDevices: () => ipcRenderer.invoke(IPC_CHANNELS.SCAN_DEVICES),

  onStatusChange: (callback: (status: AppStatus) => void) =>
    createIpcListener(IPC_CHANNELS.APP_STATUS_CHANGED, callback),

  windowControls: {
    minimize: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MINIMIZE),
    toggleMaximize: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_TOGGLE_MAXIMIZE),
    close: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_CLOSE),
    getState: (): Promise<WindowState> => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_GET_STATE),
    onStateChange: (callback: (state: WindowState) => void) =>
      createIpcListener(IPC_CHANNELS.WINDOW_STATE_CHANGED, callback)
  }
};

contextBridge.exposeInMainWorld('homeSentinel', api);
