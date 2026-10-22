import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { openDatabase, type DbConnection } from '../src/db/connection';
import { SessionRepository } from '../src/SessionRepository';

const open: DbConnection[] = [];
afterEach(() => {
  for (const db of open) db.close();
  open.length = 0;
});

function makeRepo(): SessionRepository {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-session-'));
  const db = openDatabase(path.join(dir, 'test.db'));
  open.push(db);
  return new SessionRepository(db);
}

describe('SessionRepository', () => {
  it('creates and retrieves a session', () => {
    const repo = makeRepo();
    const created = repo.create({ title: 'Hello', workspacePath: '/ws' });
    expect(created.id).toBeTruthy();
    expect(created.createdAt).toBeGreaterThan(0);
    expect(created.tokenUsage).toBe(0);
    expect(repo.getById(created.id)).toEqual(created);
  });

  it('lists all sessions', () => {
    const repo = makeRepo();
    const a = repo.create({ title: 'a', workspacePath: '/a' });
    const b = repo.create({ title: 'b', workspacePath: '/b' });
    const ids = repo.list().map((s) => s.id).sort();
    expect(ids).toEqual([a.id, b.id].sort());
  });

  it('updates a session and bumps updatedAt', () => {
    const repo = makeRepo();
    const created = repo.create({ title: 'before', workspacePath: '/ws' });
    const updated = repo.update(created.id, { title: 'after', tokenUsage: 42 });
    expect(updated?.title).toBe('after');
    expect(updated?.tokenUsage).toBe(42);
    expect(updated?.updatedAt).toBeGreaterThanOrEqual(created.updatedAt);
    expect(repo.getById(created.id)?.title).toBe('after');
  });

  it('returns undefined when updating a missing session', () => {
    const repo = makeRepo();
    expect(repo.update('nope', { title: 'x' })).toBeUndefined();
  });

  it('deletes a session', () => {
    const repo = makeRepo();
    const created = repo.create({ title: 'x', workspacePath: '/x' });
    expect(repo.delete(created.id)).toBe(true);
    expect(repo.getById(created.id)).toBeUndefined();
    expect(repo.delete(created.id)).toBe(false);
  });
});
