import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { searchCodeTool } from '../src/tools/implementations/searchCode';

function makeWs(): string {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-search-'));
  fs.mkdirSync(path.join(ws, 'src'));
  fs.writeFileSync(path.join(ws, 'src', 'a.ts'), 'const hello = 1;\nconst world = 2;');
  fs.writeFileSync(path.join(ws, 'notes.md'), 'hello world');
  fs.writeFileSync(path.join(ws, '.env'), 'SECRET=hello');
  return ws;
}

describe('search_code tool', () => {
  it('finds matches with line numbers', async () => {
    const ws = makeWs();
    const res = await searchCodeTool.execute({ pattern: 'hello' }, { workspaceRoot: ws });
    expect(res.success).toBe(true);
    expect(res.content).toContain('a.ts:1:');
    expect(res.content).toContain('notes.md:1:');
  });

  it('does not search sensitive files', async () => {
    const ws = makeWs();
    const res = await searchCodeTool.execute({ pattern: 'SECRET' }, { workspaceRoot: ws });
    expect(res.success).toBe(true);
    expect(res.content).toBe('(no matches)');
  });

  it('scopes the search to a sub-path', async () => {
    const ws = makeWs();
    const res = await searchCodeTool.execute({ pattern: 'world', path: 'src' }, { workspaceRoot: ws });
    expect(res.content).toContain('a.ts');
    expect(res.content).not.toContain('notes.md');
  });

  it('returns an error for an invalid regex', async () => {
    const ws = makeWs();
    const res = await searchCodeTool.execute({ pattern: '[unclosed' }, { workspaceRoot: ws });
    expect(res.success).toBe(false);
    expect(res.error).toContain('regex');
  });
});
