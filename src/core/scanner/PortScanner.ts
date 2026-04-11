import net from 'node:net';
import pLimit from 'p-limit';
import type { Device } from '../../shared/types';
import log from '../logger';

const DEFAULT_PORT_TIMEOUT_MS = 350;
const DEFAULT_DEVICE_CONCURRENCY = 10;
const DEFAULT_SOCKET_CONCURRENCY = 50;
const COMMON_PORTS = [22, 53, 80, 139, 443, 445, 515, 631, 9100, 3389, 62078];

export class PortScanner {
  private readonly socketLimit = pLimit(DEFAULT_SOCKET_CONCURRENCY);

  constructor(
    private readonly timeoutMs = DEFAULT_PORT_TIMEOUT_MS,
    private readonly deviceConcurrency = DEFAULT_DEVICE_CONCURRENCY,
    private readonly ports = COMMON_PORTS
  ) {}

  async scanDevices(devices: Device[]): Promise<Device[]> {
    log.info(`[PortScanner] Escaneando puertos en ${devices.length} dispositivos`);

    const enrichedDevices: Device[] = [];

    for (let index = 0; index < devices.length; index += this.deviceConcurrency) {
      const batch = devices.slice(index, index + this.deviceConcurrency);
      const batchResults = await Promise.all(
        batch.map(async (device) => ({
          ...device,
          openPorts: await this.scanPorts(device.ip)
        }))
      );

      enrichedDevices.push(...batchResults);
    }

    const totalPorts = enrichedDevices.reduce((sum, d) => sum + (d.openPorts?.length ?? 0), 0);
    log.info(`[PortScanner] Escaneo de puertos finalizado: ${totalPorts} puertos abiertos detectados`);

    return enrichedDevices;
  }

  private async scanPorts(ip: string): Promise<number[]> {
    const portChecks = await Promise.all(
      this.ports.map((port) =>
        this.socketLimit(async () => ({
          port,
          open: await this.isPortOpen(ip, port)
        }))
      )
    );

    return portChecks
      .filter((result) => result.open)
      .map((result) => result.port)
      .sort((left, right) => left - right);
  }

  private isPortOpen(ip: string, port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      let settled = false;

      const finalize = (isOpen: boolean): void => {
        if (settled) {
          return;
        }

        settled = true;
        socket.destroy();
        resolve(isOpen);
      };

      socket.setTimeout(this.timeoutMs);
      socket.once('connect', () => finalize(true));
      socket.once('timeout', () => finalize(false));
      socket.once('error', () => finalize(false));
      socket.once('close', () => finalize(false));
      socket.connect(port, ip);
    });
  }
}
