export interface AppBootstrapState {
  status: 'idle' | 'booting' | 'ready';
  scannedDevices: number;
}
