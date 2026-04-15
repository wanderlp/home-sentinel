import type { AppStatus } from './app.types';
import type { DetectedDevice, LocalNetworkInfo } from './network.types';
import type { WindowState } from './app.types';

export interface WindowControls {
  minimize: () => Promise<void>;
  toggleMaximize: () => Promise<void>;
  close: () => Promise<void>;
  getState: () => Promise<WindowState>;
  onStateChange: (callback: (state: WindowState) => void) => () => void;
}

export interface HomeSentinelAPI {
  scanDevices: () => Promise<DetectedDevice[]>;
  getLocalNetworkInfo: () => Promise<LocalNetworkInfo>;
  onStatusChange: (callback: (status: AppStatus) => void) => () => void;
  windowControls: WindowControls;
}
