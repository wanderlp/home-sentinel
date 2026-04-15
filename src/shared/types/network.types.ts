export interface LocalNetworkInfo {
  hostname: string;
  ip: string;
  mac: string;
  interfaceName: string;
  subnet: string;
}

export type DeviceType =
  | 'router'
  | 'pc'
  | 'celular'
  | 'impresora'
  | 'iot'
  | 'desconocido';

export interface Device {
  ip: string;
  activo: boolean;
  mac?: string;
  hostname?: string;
  vendor?: string;
  deviceType?: DeviceType;
  openPorts?: number[];
  classificationConfidence?: number;
  classificationReasons?: string[];
}

export interface DetectedDevice extends Device {
  conocido: boolean;
  nuevo: boolean;
  modificado: boolean;
  changeSummary: string[];
  firstSeen?: string;
  previousLastSeen?: string;
}

export interface StoredDevice {
  id: number;
  ip: string;
  mac?: string;
  hostname?: string;
  vendor?: string;
  deviceType?: DeviceType;
  openPorts?: number[];
  firstSeen: string;
  lastSeen: string;
}

export interface NetworkDevice {
  id: string;
  ipAddress: string;
  macAddress?: string;
  hostname?: string;
  vendor?: string;
  status: 'online' | 'offline' | 'unknown';
  lastSeenAt?: string;
}

export interface NetworkScanResult {
  startedAt: string;
  finishedAt: string;
  devices: NetworkDevice[];
}
