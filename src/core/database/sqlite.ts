import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const DATABASE_DIRECTORY = path.resolve(process.cwd(), 'data');
const DATABASE_PATH = path.join(DATABASE_DIRECTORY, 'home-sentinel.db');

let databaseInstance: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (databaseInstance) {
    return databaseInstance;
  }

  fs.mkdirSync(DATABASE_DIRECTORY, { recursive: true });

  const database = new Database(DATABASE_PATH);
  database.pragma('journal_mode = WAL');

  initializeSchema(database);
  databaseInstance = database;

  return databaseInstance;
}

function initializeSchema(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip TEXT NOT NULL,
      mac TEXT UNIQUE,
      firstSeen TEXT NOT NULL,
      lastSeen TEXT NOT NULL
    );
  `);
}
