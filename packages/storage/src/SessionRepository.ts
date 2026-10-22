import { randomUUID } from 'node:crypto';
import type { SessionMetadata } from '@minimal-agent/shared-types';
import type { DbConnection } from './db/connection';

interface SessionRow {
  id: string;
  title: string;
  workspace_path: string;
  created_at: number;
  updated_at: number;
  token_usage: number;
}

export interface CreateSessionParams {
  title: string;
  workspacePath: string;
}

export interface UpdateSessionParams {
  title?: string;
  workspacePath?: string;
  tokenUsage?: number;
}

// TEACHING: Repository pattern — this is the only module that knows the
// `sessions` table. Callers work with SessionMetadata, never SQL rows.
export class SessionRepository {
  constructor(private readonly db: DbConnection) {}

  create(params: CreateSessionParams): SessionMetadata {
    const now = Date.now();
    const session: SessionMetadata = {
      id: randomUUID(),
      title: params.title,
      workspacePath: params.workspacePath,
      createdAt: now,
      updatedAt: now,
      tokenUsage: 0,
    };
    this.db
      .prepare(
        `INSERT INTO sessions (id, title, workspace_path, created_at, updated_at, token_usage)
         VALUES (@id, @title, @workspacePath, @createdAt, @updatedAt, @tokenUsage)`,
      )
      .run({
        id: session.id,
        title: session.title,
        workspacePath: session.workspacePath,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        tokenUsage: session.tokenUsage,
      });
    return session;
  }

  getById(id: string): SessionMetadata | undefined {
    const row = this.db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(id) as SessionRow | undefined;
    return row ? toSession(row) : undefined;
  }

  list(): SessionMetadata[] {
    const rows = this.db.prepare(`SELECT * FROM sessions ORDER BY updated_at DESC`).all() as unknown as SessionRow[];
    return rows.map(toSession);
  }

  update(id: string, params: UpdateSessionParams): SessionMetadata | undefined {
    const existing = this.getById(id);
    if (!existing) return undefined;

    const updated: SessionMetadata = {
      ...existing,
      title: params.title ?? existing.title,
      workspacePath: params.workspacePath ?? existing.workspacePath,
      tokenUsage: params.tokenUsage ?? existing.tokenUsage,
      updatedAt: Date.now(),
    };
    this.db
      .prepare(
        `UPDATE sessions
         SET title = @title, workspace_path = @workspacePath, token_usage = @tokenUsage, updated_at = @updatedAt
         WHERE id = @id`,
      )
      .run({
        id: updated.id,
        title: updated.title,
        workspacePath: updated.workspacePath,
        tokenUsage: updated.tokenUsage,
        updatedAt: updated.updatedAt,
      });
    return updated;
  }

  delete(id: string): boolean {
    const result = this.db.prepare(`DELETE FROM sessions WHERE id = ?`).run(id);
    return Number(result.changes) > 0;
  }
}

function toSession(row: SessionRow): SessionMetadata {
  return {
    id: row.id,
    title: row.title,
    workspacePath: row.workspace_path,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tokenUsage: row.token_usage,
  };
}
