export interface AppBootstrapState {
  status: 'idle' | 'booting' | 'ready';
  scannedDevices: number;
}

export interface WindowState {
  isMaximized: boolean;
}
