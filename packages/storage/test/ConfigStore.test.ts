import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { openDatabase, type DbConnection } from '../src/db/connection';
import { ConfigStore } from '../src/ConfigStore';

const open: DbConnection[] = [];
afterEach(() => {
  for (const db of open) db.close();
  open.length = 0;
});

function makeStore(): ConfigStore {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-config-'));
  const db = openDatabase(path.join(dir, 'test.db'));
  open.push(db);
  return new ConfigStore(db);
}

describe('ConfigStore', () => {
  it('returns defaults when nothing is stored', () => {
    const store = makeStore();
    expect(store.get()).toEqual({ apiKey: '', model: 'deepseek-v4-pro', tokenBudget: 100000 });
  });

  it('round-trips a config', () => {
    const store = makeStore();
    store.set({ apiKey: 'sk-123', model: 'deepseek-flash', tokenBudget: 5 });
    expect(store.get()).toEqual({ apiKey: 'sk-123', model: 'deepseek-flash', tokenBudget: 5 });
  });

  it('update merges partial changes', () => {
    const store = makeStore();
    store.set({ apiKey: 'sk-123', model: 'deepseek-v4-pro', tokenBudget: 100 });
    const next = store.update({ model: 'deepseek-flash' });
    expect(next).toEqual({ apiKey: 'sk-123', model: 'deepseek-flash', tokenBudget: 100 });
    expect(store.get().model).toBe('deepseek-flash');
  });

  it('keeps a single config row (upsert)', () => {
    const store = makeStore();
    store.set({ apiKey: 'a', model: 'm1', tokenBudget: 1 });
    store.set({ apiKey: 'b', model: 'm2', tokenBudget: 2 });
    expect(store.get().apiKey).toBe('b');
  });
});
