import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { TextMessage } from '@minimal-agent/shared-types';
import { MessageStore } from '../src/MessageStore';

function makeStore(): { store: MessageStore; dir: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-msg-'));
  return { store: new MessageStore(dir), dir };
}

function userMessage(id: string, content: string): TextMessage {
  return { id, role: 'user', content, timestamp: 1 };
}

describe('MessageStore', () => {
  it('appends and reads messages back in order', () => {
    const { store } = makeStore();
    const m1 = userMessage('m1', 'hello');
    const m2 = userMessage('m2', 'world');
    store.append('s1', m1);
    store.append('s1', m2);
    expect(store.read('s1')).toEqual([m1, m2]);
  });

  it('writes one JSON object per line (JSONL)', () => {
    const { store, dir } = makeStore();
    store.append('s1', userMessage('m1', 'hi'));
    const raw = fs.readFileSync(path.join(dir, 's1.jsonl'), 'utf-8');
    const lines = raw.trim().split('\n');
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0])).toMatchObject({ id: 'm1', role: 'user', content: 'hi' });
  });

  it('returns an empty list for an unknown session', () => {
    const { store } = makeStore();
    expect(store.read('nope')).toEqual([]);
  });

  it('deletes a session message log', () => {
    const { store, dir } = makeStore();
    store.append('s1', userMessage('m1', 'hi'));
    store.delete('s1');
    expect(fs.existsSync(path.join(dir, 's1.jsonl'))).toBe(false);
    expect(store.read('s1')).toEqual([]);
  });
});
