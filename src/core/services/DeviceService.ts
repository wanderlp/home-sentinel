import { DeviceRepository } from '../database/DeviceRepository';
import { HomeSentinelScanner } from '../scanner/HomeSentinelScanner';
import type { DetectedDevice, Device, StoredDevice } from '../../shared/types';

export class DeviceService {
  constructor(
    private readonly scanner = new HomeSentinelScanner(),
    private readonly repository = new DeviceRepository()
  ) {}

  async scanAndDetect(): Promise<DetectedDevice[]> {
    const scannedDevices = await this.scanner.scan();
    const knownDevices = this.repository.getKnownDevices();
    const knownMacs = this.createKnownMacSet(knownDevices);

    const detectedDevices = scannedDevices.map((device) =>
      this.mapDetectedDevice(device, knownMacs)
    );

    this.repository.saveDevices(scannedDevices);

    return detectedDevices;
  }

  private createKnownMacSet(devices: StoredDevice[]): Set<string> {
    return new Set(devices.map((device) => device.mac));
  }

  private mapDetectedDevice(device: Device, knownMacs: Set<string>): DetectedDevice {
    const isKnown = Boolean(device.mac && knownMacs.has(device.mac));

    return {
      ...device,
      conocido: isKnown,
      nuevo: !isKnown
    };
  }
}
