import { DeviceRepository } from '../database/DeviceRepository';
import { HomeSentinelScanner } from '../scanner/HomeSentinelScanner';
import { PortScanner } from '../scanner/PortScanner';
import { DeviceClassifier } from '../classification/DeviceClassifier';
import type { DetectedDevice, Device, StoredDevice } from '../../shared/types';

export class DeviceService {
  constructor(
    private readonly scanner = new HomeSentinelScanner(),
    private readonly portScanner = new PortScanner(),
    private readonly repository = new DeviceRepository(),
    private readonly classifier = new DeviceClassifier()
  ) {}

  async scanAndDetect(): Promise<DetectedDevice[]> {
    const scannedDevices = await this.portScanner.scanDevices(await this.scanner.scan());
    const classifiedDevices = scannedDevices.map((device) => this.classifier.classify(device));
    const knownDevices = await this.repository.getKnownDevices();
    const knownDevicesByMac = this.createKnownDeviceMap(knownDevices);

    const detectedDevices = classifiedDevices
      .map((device) => this.mapDetectedDevice(device, knownDevicesByMac))
      .sort((left, right) => this.rankDevice(right) - this.rankDevice(left));

    await this.repository.saveDevices(classifiedDevices);

    return detectedDevices;
  }

  private createKnownDeviceMap(devices: StoredDevice[]): Map<string, StoredDevice> {
    return new Map(devices.map((device) => [device.mac, device]));
  }

  private mapDetectedDevice(
    device: Device,
    knownDevicesByMac: Map<string, StoredDevice>
  ): DetectedDevice {
    const knownDevice = device.mac ? knownDevicesByMac.get(device.mac) : undefined;
    const isKnown = Boolean(knownDevice);
    const now = new Date().toISOString();
    const changeSummary = knownDevice ? this.buildChangeSummary(device, knownDevice) : [];
    const isModified = changeSummary.length > 0;

    return {
      ...device,
      conocido: isKnown,
      nuevo: !isKnown,
      modificado: isModified,
      changeSummary,
      firstSeen: knownDevice?.firstSeen ?? now,
      previousLastSeen: knownDevice?.lastSeen
    };
  }

  private buildChangeSummary(device: Device, knownDevice: StoredDevice): string[] {
    const changes: string[] = [];

    if ((device.hostname ?? '') !== (knownDevice.hostname ?? '')) {
      changes.push('El nombre del dispositivo cambió desde el último registro.');
    }

    if ((device.vendor ?? '') !== (knownDevice.vendor ?? '')) {
      changes.push('El fabricante detectado cambió respecto al registro anterior.');
    }

    if ((device.deviceType ?? '') !== (knownDevice.deviceType ?? '')) {
      changes.push('El tipo estimado del dispositivo cambió.');
    }

    if (!this.arePortsEqual(device.openPorts ?? [], knownDevice.openPorts ?? [])) {
      changes.push('La lista de puertos abiertos cambió desde el último escaneo.');
    }

    return changes;
  }

  private arePortsEqual(currentPorts: number[], previousPorts: number[]): boolean {
    if (currentPorts.length !== previousPorts.length) {
      return false;
    }

    return currentPorts.every((port, index) => port === previousPorts[index]);
  }

  private rankDevice(device: DetectedDevice): number {
    if (device.nuevo) {
      return 3;
    }

    if (device.modificado) {
      return 2;
    }

    if (device.conocido) {
      return 1;
    }

    return 0;
  }
}
