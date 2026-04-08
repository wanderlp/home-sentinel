export interface Device {
  ip: string;
  activo: boolean;
  macAddress?: string;
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
