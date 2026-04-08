import { contextBridge, ipcRenderer } from 'electron';
import type { AppBootstrapState, DetectedDevice } from '../../shared/types';

const bootstrapState: AppBootstrapState = {
  status: 'idle',
  scannedDevices: 0
};

contextBridge.exposeInMainWorld('homeSentinel', {
  getBootstrapState: (): AppBootstrapState => bootstrapState,
  scanDevices: (): Promise<DetectedDevice[]> => ipcRenderer.invoke('scan-devices')
});
