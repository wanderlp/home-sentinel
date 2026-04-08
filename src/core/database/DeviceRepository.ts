import type sqlite3 from 'sqlite3';
import { allRows, getDatabase, runStatement } from './sqlite';
import type { Device, StoredDevice } from '../../shared/types';

interface DeviceRow {
  id: number;
  ip: string;
  mac: string;
  hostname?: string | null;
  firstSeen: string;
  lastSeen: string;
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
        if (!device.mac) {
          continue;
        }

        const timestamp = new Date().toISOString();
        await runStatement(
          database,
          `
            INSERT INTO devices (ip, mac, hostname, firstSeen, lastSeen)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(mac) DO UPDATE SET
              ip = excluded.ip,
              hostname = excluded.hostname,
              lastSeen = excluded.lastSeen
          `,
          [device.ip, device.mac, device.hostname ?? null, timestamp, timestamp]
        );
      }

      await runStatement(database, 'COMMIT');
    } catch (error) {
      if (database) {
        await runStatement(database, 'ROLLBACK').catch(() => undefined);
      }

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
          SELECT id, ip, mac, hostname, firstSeen, lastSeen
          FROM devices
          ORDER BY lastSeen DESC
        `
      );

      return rows.map((row) => this.mapRowToStoredDevice(row));
    } catch (error) {
      throw new Error(
        `No se pudieron obtener los dispositivos guardados: ${this.getErrorMessage(error)}`
      );
    }
  }

  private mapRowToStoredDevice(row: DeviceRow): StoredDevice {
    return {
      id: row.id,
      ip: row.ip,
      mac: row.mac,
      hostname: row.hostname ?? undefined,
      firstSeen: row.firstSeen,
      lastSeen: row.lastSeen
    };
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return 'Error desconocido';
  }
}
