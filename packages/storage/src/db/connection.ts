import { DatabaseSync } from 'node:sqlite';

// Alias the built-in connection type so the rest of the package does not
// import the node:sqlite module directly.
export type DbConnection = DatabaseSync;

// TEACHING: The schema is applied idempotently (CREATE TABLE IF NOT EXISTS) on
// every open. It is inlined as a string so the module bundles cleanly into the
// Electron main process (a separate .sql file would not be carried by the
// bundler alongside the code that reads it).
//
//   sessions — one row per conversation; messages go to a JSONL file instead.
//   config   — a singleton (single row, id always 1).
const schema = `
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  workspace_path TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  token_usage INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  api_key TEXT,
  model TEXT NOT NULL DEFAULT 'deepseek-v4-pro',
  token_budget INTEGER NOT NULL DEFAULT 100000
);
`;

export function openDatabase(dbPath: string): DbConnection {
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec(schema);
  return db;
}
