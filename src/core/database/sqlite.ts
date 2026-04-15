import fs from 'node:fs';
import path from 'node:path';
import sqlite3 from 'sqlite3';

const DATABASE_DIRECTORY = path.resolve(process.cwd(), 'data');
const DATABASE_PATH = path.join(DATABASE_DIRECTORY, 'home-sentinel.db');

let databaseInstance: sqlite3.Database | null = null;
let databasePromise: Promise<sqlite3.Database> | null = null;

export async function getDatabase(): Promise<sqlite3.Database> {
  if (databaseInstance) {
    return databaseInstance;
  }

  if (!databasePromise) {
    databasePromise = initializeDatabase();
  }

  return databasePromise;
}

async function initializeDatabase(): Promise<sqlite3.Database> {
  try {
    fs.mkdirSync(DATABASE_DIRECTORY, { recursive: true });
    const database = await openDatabase(DATABASE_PATH);
    await runStatement(database, 'PRAGMA journal_mode = WAL');
    await initializeSchema(database);
    databaseInstance = database;
    return database;
  } catch (error) {
    // Permite reintentar en el siguiente llamado
    databasePromise = null;
    throw error;
  }
}

async function initializeSchema(database: sqlite3.Database): Promise<void> {
  await runStatement(
    database,
    `
      CREATE TABLE IF NOT EXISTS devices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ip TEXT NOT NULL,
        mac TEXT UNIQUE,
        hostname TEXT,
        vendor TEXT,
        deviceType TEXT,
        firstSeen TEXT NOT NULL,
        lastSeen TEXT NOT NULL
      );
    `
  );

  await runStatement(
    database,
    `
      CREATE TABLE IF NOT EXISTS device_ports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        deviceMac TEXT NOT NULL,
        port INTEGER NOT NULL,
        lastSeen TEXT NOT NULL,
        UNIQUE(deviceMac, port)
      );
    `
  );

  await ensureColumnExists(database, 'devices', 'hostname', 'TEXT');
  await ensureColumnExists(database, 'devices', 'vendor', 'TEXT');
  await ensureColumnExists(database, 'devices', 'deviceType', 'TEXT');

  // Índice parcial para upsert de dispositivos sin MAC usando IP como clave alternativa
  await runStatement(
    database,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_devices_ip_no_mac ON devices(ip) WHERE mac IS NULL`
  );

  // Índices de rendimiento para queries frecuentes
  await runStatement(
    database,
    `CREATE INDEX IF NOT EXISTS idx_devices_lastSeen ON devices(lastSeen DESC)`
  );

  await runStatement(
    database,
    `CREATE INDEX IF NOT EXISTS idx_device_ports_mac ON device_ports(deviceMac)`
  );
}

function openDatabase(databasePath: string): Promise<sqlite3.Database> {
  return new Promise((resolve, reject) => {
    const database = new sqlite3.Database(databasePath, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(database);
    });
  });
}

export function runStatement(
  database: sqlite3.Database,
  sql: string,
  params: unknown[] = []
): Promise<void> {
  return new Promise((resolve, reject) => {
    database.run(sql, params, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

export function allRows<Row>(
  database: sqlite3.Database,
  sql: string,
  params: unknown[] = []
): Promise<Row[]> {
  return new Promise((resolve, reject) => {
    database.all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }

      resolve((rows as Row[]) ?? []);
    });
  });
}

async function ensureColumnExists(
  database: sqlite3.Database,
  tableName: string,
  columnName: string,
  columnDefinition: string
): Promise<void> {
  try {
    await runStatement(
      database,
      `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`
    );
  } catch (error) {
    // SQLite lanza error "duplicate column name" si la columna ya existe — se ignora
    const message = error instanceof Error ? error.message : '';
    if (!message.includes('duplicate column name')) {
      throw error;
    }
  }
}
