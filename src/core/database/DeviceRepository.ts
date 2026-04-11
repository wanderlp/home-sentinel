import type sqlite3 from 'sqlite3';
import { allRows, getDatabase, runStatement } from './sqlite';
import type { Device, DeviceType, StoredDevice } from '../../shared/types';
import log from '../logger';

interface DeviceRow {
  id: number;
  ip: string;
  mac: string | null;
  hostname?: string | null;
  vendor?: string | null;
  deviceType?: string | null;
  firstSeen: string;
  lastSeen: string;
}

interface DevicePortRow {
  deviceMac: string;
  port: number;
}

export class DeviceRepository {
  constructor(
    private readonly databaseFactory: () => Promise<sqlite3.Database> = getDatabase
  ) {}

  async saveDevices(devices: Device[]): Promise<void> {
    if (devices.length === 0) {
      return;
    }

    let database: sqlite3.Database | null = null;

    try {
      database = await this.databaseFactory();
      await runStatement(database, 'BEGIN TRANSACTION');

      for (const device of devices) {
        const timestamp = new Date().toISOString();

        if (!device.mac) {
          log.warn(`[DeviceRepository] Dispositivo sin MAC en ${device.ip} — se persiste usando IP como clave alternativa`);
          await runStatement(
            database,
            `
              INSERT INTO devices (ip, mac, hostname, vendor, deviceType, firstSeen, lastSeen)
              VALUES (?, NULL, ?, ?, ?, ?, ?)
              ON CONFLICT(ip) WHERE mac IS NULL DO UPDATE SET
                hostname = excluded.hostname,
                vendor = excluded.vendor,
                deviceType = excluded.deviceType,
                lastSeen = excluded.lastSeen
            `,
            [
              device.ip,
              device.hostname ?? null,
              device.vendor ?? null,
              device.deviceType ?? null,
              timestamp,
              timestamp
            ]
          );
          // No se persisten puertos para dispositivos sin MAC
          continue;
        }

        await runStatement(
          database,
          `
            INSERT INTO devices (ip, mac, hostname, vendor, deviceType, firstSeen, lastSeen)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(mac) DO UPDATE SET
              ip = excluded.ip,
              hostname = excluded.hostname,
              vendor = excluded.vendor,
              deviceType = excluded.deviceType,
              lastSeen = excluded.lastSeen
          `,
          [
            device.ip,
            device.mac,
            device.hostname ?? null,
            device.vendor ?? null,
            device.deviceType ?? null,
            timestamp,
            timestamp
          ]
        );

        await runStatement(
          database,
          `
            DELETE FROM device_ports
            WHERE deviceMac = ?
          `,
          [device.mac]
        );

        for (const port of device.openPorts ?? []) {
          await runStatement(
            database,
            `
              INSERT INTO device_ports (deviceMac, port, lastSeen)
              VALUES (?, ?, ?)
            `,
            [device.mac, port, timestamp]
          );
        }
      }

      await runStatement(database, 'COMMIT');
    } catch (error) {
      if (database) {
        await runStatement(database, 'ROLLBACK').catch((rollbackError) => {
          log.warn('[DeviceRepository] Error al hacer ROLLBACK de la transacción', rollbackError);
        });
      }

      log.error('[DeviceRepository] Error al guardar dispositivos en SQLite', error);
      throw new Error(
        `No se pudieron guardar los dispositivos en SQLite: ${this.getErrorMessage(error)}`
      );
    }
  }

  async getKnownDevices(): Promise<StoredDevice[]> {
    try {
      const database = await this.databaseFactory();
      const rows = await allRows<DeviceRow>(
        database,
        `
          SELECT id, ip, mac, hostname, vendor, deviceType, firstSeen, lastSeen
          FROM devices
          ORDER BY lastSeen DESC
        `
      );
      const devicePorts = await allRows<DevicePortRow>(
        database,
        `
          SELECT deviceMac, port
          FROM device_ports
        `
      );
      const portsByMac = this.groupPortsByMac(devicePorts);

      return rows.map((row) => this.mapRowToStoredDevice(row, portsByMac));
    } catch (error) {
      log.error('[DeviceRepository] Error al obtener dispositivos guardados', error);
      throw new Error(
        `No se pudieron obtener los dispositivos guardados: ${this.getErrorMessage(error)}`
      );
    }
  }

  private mapRowToStoredDevice(
    row: DeviceRow,
    portsByMac: Map<string, number[]>
  ): StoredDevice {
    return {
      id: row.id,
      ip: row.ip,
      mac: row.mac ?? undefined,
      hostname: row.hostname ?? undefined,
      vendor: row.vendor ?? undefined,
      deviceType: this.mapDeviceType(row.deviceType),
      openPorts: row.mac ? (portsByMac.get(row.mac) ?? []) : [],
      firstSeen: row.firstSeen,
      lastSeen: row.lastSeen
    };
  }

  private groupPortsByMac(rows: DevicePortRow[]): Map<string, number[]> {
    const portsByMac = new Map<string, number[]>();

    for (const row of rows) {
      const existingPorts = portsByMac.get(row.deviceMac) ?? [];
      existingPorts.push(row.port);
      portsByMac.set(row.deviceMac, existingPorts);
    }

    for (const [mac, ports] of portsByMac.entries()) {
      portsByMac.set(mac, ports.sort((left, right) => left - right));
    }

    return portsByMac;
  }

  private mapDeviceType(deviceType?: string | null): DeviceType | undefined {
    if (!deviceType) {
      return undefined;
    }

    const VALID_DEVICE_TYPES: DeviceType[] = ['router', 'pc', 'celular', 'impresora', 'iot', 'desconocido'];

    if (VALID_DEVICE_TYPES.includes(deviceType as DeviceType)) {
      return deviceType as DeviceType;
    }

    log.warn(`[DeviceRepository] Valor de deviceType desconocido en BD: "${deviceType}" — se normaliza a "desconocido"`);
    return 'desconocido';
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return 'Error desconocido';
  }
}
