import { execFile } from 'node:child_process';
import { networkInterfaces } from 'node:os';
import { promisify } from 'node:util';
import type { Device } from '../../shared/types';

const execFileAsync = promisify(execFile);
const WINDOWS_PING_TIMEOUT_MS = 1000;
const DEFAULT_CONCURRENCY = 25;

interface LocalNetworkInfo {
  ip: string;
  netmask: string;
}

export class HomeSentinelScanner {
  constructor(private readonly concurrency = DEFAULT_CONCURRENCY) {}

  async scan(): Promise<Device[]> {
    this.ensureWindowsSupport();

    const localNetwork = this.getLocalNetworkInfo();
    const hostIps = this.getHostIpsFromSubnet(localNetwork.ip, localNetwork.netmask);

    return this.scanIpBatch(hostIps);
  }

  private ensureWindowsSupport(): void {
    if (process.platform !== 'win32') {
      throw new Error('HomeSentinelScanner actualmente solo soporta escaneo con ping en Windows.');
    }
  }

  private getLocalNetworkInfo(): LocalNetworkInfo {
    const interfaces = networkInterfaces();

    for (const addresses of Object.values(interfaces)) {
      if (!addresses) {
        continue;
      }

      for (const address of addresses) {
        if (address.family !== 'IPv4' || address.internal || !address.netmask) {
          continue;
        }

        return {
          ip: address.address,
          netmask: address.netmask
        };
      }
    }

    throw new Error('No se pudo detectar una interfaz IPv4 local activa.');
  }

  private getHostIpsFromSubnet(ipAddress: string, netmask: string): string[] {
    const ip = this.ipToNumber(ipAddress);
    const mask = this.ipToNumber(netmask);
    const networkAddress = ip & mask;
    const broadcastAddress = networkAddress | (~mask >>> 0);

    if (broadcastAddress - networkAddress <= 1) {
      return [ipAddress];
    }

    const hostIps: string[] = [];

    for (let current = networkAddress + 1; current < broadcastAddress; current += 1) {
      hostIps.push(this.numberToIp(current >>> 0));
    }

    return hostIps;
  }

  private ipToNumber(ipAddress: string): number {
    const octets = ipAddress.split('.').map((segment) => Number.parseInt(segment, 10));

    if (octets.length !== 4 || octets.some((octet) => Number.isNaN(octet) || octet < 0 || octet > 255)) {
      throw new Error(`Dirección IPv4 inválida: ${ipAddress}`);
    }

    return (
      ((octets[0] << 24) >>> 0) +
      ((octets[1] << 16) >>> 0) +
      ((octets[2] << 8) >>> 0) +
      (octets[3] >>> 0)
    ) >>> 0;
  }

  private numberToIp(value: number): string {
    return [
      (value >>> 24) & 255,
      (value >>> 16) & 255,
      (value >>> 8) & 255,
      value & 255
    ].join('.');
  }

  private async scanIpBatch(hostIps: string[]): Promise<Device[]> {
    const results: Device[] = [];

    for (let index = 0; index < hostIps.length; index += this.concurrency) {
      const batch = hostIps.slice(index, index + this.concurrency);
      const batchResults = await Promise.all(batch.map(async (ip) => this.pingIp(ip)));
      results.push(...batchResults);
    }

    return results.filter((device) => device.activo);
  }

  private async pingIp(ip: string): Promise<Device> {
    try {
      await execFileAsync('ping', ['-n', '1', '-w', String(WINDOWS_PING_TIMEOUT_MS), ip]);

      return {
        ip,
        activo: true
      };
    } catch {
      return {
        ip,
        activo: false
      };
    }
  }
}
