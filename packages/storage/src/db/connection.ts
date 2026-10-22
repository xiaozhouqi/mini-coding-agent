import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

// Alias the built-in connection type so the rest of the package does not
// import the node:sqlite module directly.
export type DbConnection = DatabaseSync;

// TEACHING: The schema lives in a separate .sql file, read once at open time
// and applied idempotently (CREATE TABLE IF NOT EXISTS).
const schema = readFileSync(new URL('./init.sql', import.meta.url), 'utf-8');

export function openDatabase(dbPath: string): DbConnection {
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec(schema);
  return db;
}
