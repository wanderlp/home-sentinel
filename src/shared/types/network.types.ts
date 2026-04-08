export interface Device {
  ip: string;
  activo: boolean;
  mac?: string;
}

export interface StoredDevice {
  id: number;
  ip: string;
  mac: string;
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
