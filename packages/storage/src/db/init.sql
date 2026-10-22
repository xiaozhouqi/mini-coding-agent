-- Session metadata: one row per conversation. Messages are appended to a
-- per-session JSONL file (see MessageStore), not stored in this table.
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  workspace_path TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  token_usage INTEGER NOT NULL DEFAULT 0
);

-- App config: a singleton (single row, id always 1).
CREATE TABLE IF NOT EXISTS config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  api_key TEXT,
  model TEXT NOT NULL DEFAULT 'deepseek-v4-pro',
  token_budget INTEGER NOT NULL DEFAULT 100000
);
