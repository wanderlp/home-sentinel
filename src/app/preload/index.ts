import { contextBridge, ipcRenderer } from 'electron';
import type { AppStatus, HomeSentinelAPI, WindowState } from '../../shared/types';

const api: HomeSentinelAPI = {
  scanDevices: () => ipcRenderer.invoke('scan-devices'),

  onStatusChange: (callback: (status: AppStatus) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, status: AppStatus) => {
      callback(status);
    };

    ipcRenderer.on('app-status-changed', listener);

    return () => {
      ipcRenderer.removeListener('app-status-changed', listener);
    };
  },

  windowControls: {
    minimize: (): Promise<void> => ipcRenderer.invoke('window:minimize'),
    toggleMaximize: (): Promise<void> => ipcRenderer.invoke('window:toggle-maximize'),
    close: (): Promise<void> => ipcRenderer.invoke('window:close'),
    getState: (): Promise<WindowState> => ipcRenderer.invoke('window:get-state'),
    onStateChange: (callback: (state: WindowState) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, state: WindowState) => {
        callback(state);
      };

      ipcRenderer.on('window-state-changed', listener);

      return () => {
        ipcRenderer.removeListener('window-state-changed', listener);
      };
    }
  }
};

contextBridge.exposeInMainWorld('homeSentinel', api);
