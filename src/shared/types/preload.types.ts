import type { AppBootstrapState } from './app.types';
import type { DetectedDevice } from './network.types';
import type { WindowState } from './app.types';

export interface WindowControls {
  minimize: () => Promise<void>;
  toggleMaximize: () => Promise<void>;
  close: () => Promise<void>;
  getState: () => Promise<WindowState>;
  onStateChange: (callback: (state: WindowState) => void) => () => void;
}

export interface HomeSentinelAPI {
  getBootstrapState: () => AppBootstrapState;
  scanDevices: () => Promise<DetectedDevice[]>;
  windowControls: WindowControls;
}
