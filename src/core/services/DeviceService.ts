import { DeviceRepository } from '../database/DeviceRepository';
import { HomeSentinelScanner } from '../scanner/HomeSentinelScanner';
import { DeviceClassifier } from '../classification/DeviceClassifier';
import type { DetectedDevice, Device, StoredDevice } from '../../shared/types';

export class DeviceService {
  constructor(
    private readonly scanner = new HomeSentinelScanner(),
    private readonly repository = new DeviceRepository(),
    private readonly classifier = new DeviceClassifier()
  ) {}

  async scanAndDetect(): Promise<DetectedDevice[]> {
    const scannedDevices = (await this.scanner.scan()).map((device) =>
      this.classifier.classify(device)
    );
    const knownDevices = await this.repository.getKnownDevices();
    const knownMacs = this.createKnownMacSet(knownDevices);

    const detectedDevices = scannedDevices.map((device) =>
      this.mapDetectedDevice(device, knownMacs)
    );

    await this.repository.saveDevices(scannedDevices);

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
