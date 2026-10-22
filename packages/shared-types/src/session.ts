// Session metadata persisted in SQLite (one row per conversation). The actual
// messages live in a per-session JSONL file — see the storage package's
// MessageStore.
export interface SessionMetadata {
  id: string;
  title: string;
  workspacePath: string;
  createdAt: number;
  updatedAt: number;
  tokenUsage: number;
}
