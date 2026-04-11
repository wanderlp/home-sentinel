import { execFile } from 'node:child_process';
import { reverse } from 'node:dns/promises';
import { networkInterfaces } from 'node:os';
import { promisify } from 'node:util';
import type { Device } from '../../shared/types';
import log from '../logger';

const execFileAsync = promisify(execFile);
const WINDOWS_PING_TIMEOUT_MS = 1000;
const DEFAULT_CONCURRENCY = 25;
const ARP_ENTRY_REGEX = /^\s*(\d{1,3}(?:\.\d{1,3}){3})\s+([0-9a-f-]{17})\s+\S+\s*$/i;
const WINDOWS_PING_HOSTNAME_REGEX = /Haciendo ping a\s+([^\s\[]+)\s+\[|\bPinging\s+([^\s\[]+)\s+\[/i;

interface LocalNetworkInfo {
  ip: string;
  netmask: string;
}

export class HomeSentinelScanner {
  constructor(private readonly concurrency = DEFAULT_CONCURRENCY) {}

  async scan(): Promise<Device[]> {
    const activeDevices = await this.scanActiveDevices();
    return this.enrichWithHostnames(activeDevices);
  }

  /**
   * Fase 1 del escaneo: ping a toda la subred + tabla ARP.
   * Retorna los dispositivos activos con su MAC pero sin hostname.
   * Separarla permite iniciar el escaneo de puertos en paralelo con
   * la resolución de hostnames (fase 2).
   */
  async scanActiveDevices(): Promise<Device[]> {
    this.ensureWindowsSupport();

    const localNetwork = this.getLocalNetworkInfo();
    const hostIps = this.getHostIpsFromSubnet(localNetwork.ip, localNetwork.netmask);

    log.info(`[Scanner] Iniciando escaneo de ${hostIps.length} IPs en la subred ${localNetwork.ip}`);

    const activeDevices = await this.scanIpBatch(hostIps);
    const macByIp = await this.getArpTableMap();

    const result = activeDevices.map((device) => ({
      ...device,
      mac: macByIp.get(device.ip)
    }));

    log.info(`[Scanner] Ping completado: ${result.length} dispositivos activos encontrados`);

    return result;
  }

  /**
   * Fase 2 del escaneo: resolución de hostname por DNS inverso y ping -a.
   * Puede ejecutarse en paralelo con el escaneo de puertos.
   */
  async enrichWithHostnames(devices: Device[]): Promise<Device[]> {
    return this.enrichDevicesWithHostname(devices);
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
      throw new Error(`Direccion IPv4 invalida: ${ipAddress}`);
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

  private async enrichDevicesWithHostname(devices: Device[]): Promise<Device[]> {
    const enrichedDevices: Device[] = [];

    for (let index = 0; index < devices.length; index += this.concurrency) {
      const batch = devices.slice(index, index + this.concurrency);
      const batchResults = await Promise.all(
        batch.map(async (device) => ({
          ...device,
          hostname: await this.resolveHostname(device.ip)
        }))
      );

      enrichedDevices.push(...batchResults);
    }

    return enrichedDevices;
  }

  private async resolveHostname(ip: string): Promise<string | undefined> {
    const dnsHostname = await this.resolveHostnameFromReverseDns(ip);

    if (dnsHostname) {
      return dnsHostname;
    }

    return this.resolveHostnameFromPing(ip);
  }

  private async resolveHostnameFromReverseDns(ip: string): Promise<string | undefined> {
    try {
      const hostnames = await reverse(ip);
      return hostnames[0];
    } catch {
      return undefined;
    }
  }

  private async resolveHostnameFromPing(ip: string): Promise<string | undefined> {
    try {
      const { stdout } = await execFileAsync('ping', ['-a', '-n', '1', '-w', String(WINDOWS_PING_TIMEOUT_MS), ip]);
      return this.parseHostnameFromPing(stdout, ip);
    } catch {
      return undefined;
    }
  }

  private parseHostnameFromPing(pingOutput: string, ip: string): string | undefined {
    const match = pingOutput.match(WINDOWS_PING_HOSTNAME_REGEX);
    const hostname = match?.[1] ?? match?.[2];

    if (!hostname || hostname === ip) {
      return undefined;
    }

    return hostname;
  }

  private async getArpTableMap(): Promise<Map<string, string>> {
    try {
      const { stdout } = await execFileAsync('arp', ['-a']);
      return this.parseArpTable(stdout);
    } catch (error) {
      log.warn('[Scanner] No se pudo obtener la tabla ARP — los dispositivos no tendrán MAC asignada', error);
      return new Map();
    }
  }

  private parseArpTable(arpOutput: string): Map<string, string> {
    const macByIp = new Map<string, string>();
    const lines = arpOutput.split(/\r?\n/);

    for (const line of lines) {
      const entry = line.match(ARP_ENTRY_REGEX);

      if (!entry) {
        continue;
      }

      const [, ip, mac] = entry;
      macByIp.set(ip, this.normalizeMacAddress(mac));
    }

    return macByIp;
  }

  private normalizeMacAddress(macAddress: string): string {
    return macAddress.toLowerCase().replace(/-/g, ':');
  }
}
