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
}

export interface DetectedDevice extends Device {
  conocido: boolean;
  nuevo: boolean;
}

export interface StoredDevice {
  id: number;
  ip: string;
  mac: string;
  hostname?: string;
  vendor?: string;
  deviceType?: DeviceType;
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
