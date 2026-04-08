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

  if (databasePromise) {
    return databasePromise;
  }

  fs.mkdirSync(DATABASE_DIRECTORY, { recursive: true });

  databasePromise = openDatabase(DATABASE_PATH)
    .then(async (database) => {
      await runStatement(database, 'PRAGMA journal_mode = WAL');
      await initializeSchema(database);
      databaseInstance = database;
      return database;
    })
    .finally(() => {
      databasePromise = null;
    });

  return databasePromise;
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
        firstSeen TEXT NOT NULL,
        lastSeen TEXT NOT NULL
      );
    `
  );

  await ensureColumnExists(database, 'devices', 'hostname', 'TEXT');
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
  const columns = await allRows<{ name: string }>(
    database,
    `PRAGMA table_info(${tableName})`
  );

  const hasColumn = columns.some((column) => column.name === columnName);

  if (hasColumn) {
    return;
  }

  await runStatement(
    database,
    `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`
  );
}
