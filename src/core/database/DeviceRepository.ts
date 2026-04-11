import type sqlite3 from 'sqlite3';
import { allRows, getDatabase, runStatement } from './sqlite';
import type { Device, DeviceType, StoredDevice } from '../../shared/types';
import log from '../logger';

interface DeviceWithPortRow {
  id: number;
  ip: string;
  mac: string | null;
  hostname?: string | null;
  vendor?: string | null;
  deviceType?: string | null;
  firstSeen: string;
  lastSeen: string;
  port: number | null;
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
      const rows = await allRows<DeviceWithPortRow>(
        database,
        `
          SELECT d.id, d.ip, d.mac, d.hostname, d.vendor, d.deviceType,
                 d.firstSeen, d.lastSeen, dp.port
          FROM devices d
          LEFT JOIN device_ports dp ON d.mac = dp.deviceMac
          ORDER BY d.lastSeen DESC, dp.port ASC
        `
      );

      return this.aggregateDevicesFromRows(rows);
    } catch (error) {
      log.error('[DeviceRepository] Error al obtener dispositivos guardados', error);
      throw new Error(
        `No se pudieron obtener los dispositivos guardados: ${this.getErrorMessage(error)}`
      );
    }
  }

  private aggregateDevicesFromRows(rows: DeviceWithPortRow[]): StoredDevice[] {
    const deviceMap = new Map<number, StoredDevice>();

    for (const row of rows) {
      if (!deviceMap.has(row.id)) {
        deviceMap.set(row.id, {
          id: row.id,
          ip: row.ip,
          mac: row.mac ?? undefined,
          hostname: row.hostname ?? undefined,
          vendor: row.vendor ?? undefined,
          deviceType: this.mapDeviceType(row.deviceType),
          openPorts: [],
          firstSeen: row.firstSeen,
          lastSeen: row.lastSeen
        });
      }

      if (row.port !== null) {
        deviceMap.get(row.id)!.openPorts!.push(row.port);
      }
    }

    return Array.from(deviceMap.values());
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
