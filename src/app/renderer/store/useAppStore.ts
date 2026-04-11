import { create } from 'zustand';
import type { AppStatus } from '../../../shared/types';
import type { DetectedDevice } from '../../../shared/types';

interface AppStore {
  // Estado de la aplicación
  status: AppStatus;

  // Estado del escaneo
  devices: DetectedDevice[];
  scannedDevices: number;
  isScanning: boolean;
  errorMessage: string | null;

  // Estado de la ventana
  isMaximized: boolean;

  // Acciones
  setStatus: (status: AppStatus) => void;
  setDevices: (devices: DetectedDevice[]) => void;
  setScanning: (isScanning: boolean) => void;
  setError: (message: string | null) => void;
  setMaximized: (isMaximized: boolean) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  status: 'idle',
  devices: [],
  scannedDevices: 0,
  isScanning: false,
  errorMessage: null,
  isMaximized: false,

  setStatus: (status) => set({ status }),
  setDevices: (devices) => set({ devices, scannedDevices: devices.length }),
  setScanning: (isScanning) => set({ isScanning }),
  setError: (errorMessage) => set({ errorMessage }),
  setMaximized: (isMaximized) => set({ isMaximized }),
}));
