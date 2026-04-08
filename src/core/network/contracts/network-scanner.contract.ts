import type { NetworkDevice, NetworkScanResult } from '../../../shared/types/network.types';

export interface NetworkScannerContract {
  scan(): Promise<NetworkScanResult>;
}

export interface DeviceRepositoryContract {
  saveMany(devices: NetworkDevice[]): Promise<void>;
}
