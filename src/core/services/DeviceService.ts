import { DeviceRepository } from '../database/DeviceRepository';
import { HomeSentinelScanner } from '../scanner/HomeSentinelScanner';
import { PortScanner } from '../scanner/PortScanner';
import { DeviceClassifier } from '../classification/DeviceClassifier';
import type { DetectedDevice, Device, StoredDevice } from '../../shared/types';
import log from '../logger';

export class DeviceService {
  private isScanning = false;

  constructor(
    private readonly scanner = new HomeSentinelScanner(),
    private readonly portScanner = new PortScanner(),
    private readonly repository = new DeviceRepository(),
    private readonly classifier = new DeviceClassifier()
  ) {}

  async scanAndDetect(): Promise<DetectedDevice[]> {
    if (this.isScanning) {
      log.warn('[DeviceService] Escaneo rechazado — ya hay uno en curso');
      throw new Error('Ya hay un escaneo en curso. Espera a que termine antes de iniciar otro.');
    }

    this.isScanning = true;
    log.info('[DeviceService] Iniciando ciclo completo de escaneo y detección');

    try {
    // Fase 1: ping + ARP — secuencial (el ARP requiere que los pings hayan poblado la caché)
    const activeDevices = await this.scanner.scanActiveDevices();

    // Fase 2: port scan + hostname en paralelo para reducir el tiempo total de escaneo
    const [devicesWithPorts, devicesWithHostnames] = await Promise.all([
      this.portScanner.scanDevices(activeDevices),
      this.scanner.enrichWithHostnames(activeDevices)
    ]);

    const hostnameByIp = new Map(devicesWithHostnames.map((d) => [d.ip, d.hostname]));
    const mergedDevices = devicesWithPorts.map((device) => ({
      ...device,
      hostname: hostnameByIp.get(device.ip) ?? device.hostname
    }));

    const classifiedDevices = mergedDevices.map((device) => this.classifier.classify(device));
    const knownDevices = await this.repository.getKnownDevices();
    const knownDevicesMap = this.createKnownDeviceMap(knownDevices);

    const detectedDevices = classifiedDevices
      .map((device) => this.mapDetectedDevice(device, knownDevicesMap))
      .sort((left, right) => this.rankDevice(right) - this.rankDevice(left));

    await this.repository.saveDevices(classifiedDevices);

    const nuevos = detectedDevices.filter((d) => d.nuevo).length;
    const modificados = detectedDevices.filter((d) => d.modificado).length;
    const conocidos = detectedDevices.filter((d) => d.conocido && !d.nuevo).length;
    log.info(`[DeviceService] Detección completada — total: ${detectedDevices.length} | nuevos: ${nuevos} | modificados: ${modificados} | conocidos: ${conocidos}`);

    return detectedDevices;
    } finally {
      this.isScanning = false;
    }
  }

  private createKnownDeviceMap(devices: StoredDevice[]): Map<string, StoredDevice> {
    const map = new Map<string, StoredDevice>();
    for (const device of devices) {
      if (device.mac) {
        map.set(`mac:${device.mac}`, device);
      } else {
        map.set(`ip:${device.ip}`, device);
      }
    }
    return map;
  }

  private mapDetectedDevice(
    device: Device,
    knownDevicesMap: Map<string, StoredDevice>
  ): DetectedDevice {
    const lookupKey = device.mac ? `mac:${device.mac}` : `ip:${device.ip}`;
    const knownDevice = knownDevicesMap.get(lookupKey);
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
