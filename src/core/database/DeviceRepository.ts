import type Database from 'better-sqlite3';
import { getDatabase } from './sqlite';
import type { Device, StoredDevice } from '../../shared/types';

interface DeviceRow {
  id: number;
  ip: string;
  mac: string;
  firstSeen: string;
  lastSeen: string;
}

export class DeviceRepository {
  private readonly database: Database.Database;
  private readonly upsertStatement: Database.Statement<
    [string, string, string, string]
  >;
  private readonly selectAllStatement: Database.Statement<[], DeviceRow>;

  constructor(database = getDatabase()) {
    this.database = database;
    this.upsertStatement = this.database.prepare(`
      INSERT INTO devices (ip, mac, firstSeen, lastSeen)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(mac) DO UPDATE SET
        ip = excluded.ip,
        lastSeen = excluded.lastSeen
    `);
    this.selectAllStatement = this.database.prepare(`
      SELECT id, ip, mac, firstSeen, lastSeen
      FROM devices
      ORDER BY lastSeen DESC
    `);
  }

  saveDevices(devices: Device[]): void {
    if (devices.length === 0) {
      return;
    }

    const saveMany = this.database.transaction((pendingDevices: Device[]) => {
      for (const device of pendingDevices) {
        if (!device.mac) {
          continue;
        }

        const timestamp = new Date().toISOString();
        this.upsertStatement.run(device.ip, device.mac, timestamp, timestamp);
      }
    });

    try {
      saveMany(devices);
    } catch (error) {
      throw new Error(
        `No se pudieron guardar los dispositivos en SQLite: ${this.getErrorMessage(error)}`
      );
    }
  }

  getKnownDevices(): StoredDevice[] {
    try {
      const rows = this.selectAllStatement.all();
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
