export type AppStatus = 'idle' | 'booting' | 'ready';

export interface AppBootstrapState {
  status: AppStatus;
  scannedDevices: number;
}

export interface WindowState {
  isMaximized: boolean;
}
