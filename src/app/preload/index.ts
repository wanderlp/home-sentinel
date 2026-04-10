import { contextBridge, ipcRenderer } from 'electron';
import type { AppBootstrapState, DetectedDevice, WindowState } from '../../shared/types';

const bootstrapState: AppBootstrapState = {
  status: 'idle',
  scannedDevices: 0
};

contextBridge.exposeInMainWorld('homeSentinel', {
  getBootstrapState: (): AppBootstrapState => bootstrapState,
  scanDevices: (): Promise<DetectedDevice[]> => ipcRenderer.invoke('scan-devices'),
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
});
