import { contextBridge } from 'electron';
import type { AppBootstrapState } from '../../shared/types/app.types';

const bootstrapState: AppBootstrapState = {
  status: 'idle',
  scannedDevices: 0
};

contextBridge.exposeInMainWorld('homeSentinel', {
  getBootstrapState: (): AppBootstrapState => bootstrapState
});
