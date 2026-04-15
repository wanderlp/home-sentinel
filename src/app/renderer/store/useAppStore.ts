import { create } from 'zustand';
import type { AppStatus } from '../../../shared/types';
import type { DetectedDevice } from '../../../shared/types';

interface AppStore {
  status: AppStatus;
  devices: DetectedDevice[];
  isScanning: boolean;
  errorMessage: string | null;
  isMaximized: boolean;

  setStatus: (status: AppStatus) => void;
  setDevices: (devices: DetectedDevice[]) => void;
  setScanning: (isScanning: boolean) => void;
  setError: (message: string | null) => void;
  setMaximized: (isMaximized: boolean) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  status: 'idle',
  devices: [],
  isScanning: false,
  errorMessage: null,
  isMaximized: false,

  setStatus: (status) => set({ status }),
  setDevices: (devices) => set({ devices }),
  setScanning: (isScanning) => set({ isScanning }),
  setError: (errorMessage) => set({ errorMessage }),
  setMaximized: (isMaximized) => set({ isMaximized }),
}));
