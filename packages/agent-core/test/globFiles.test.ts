import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { globFilesTool } from '../src/tools/implementations/globFiles';

function makeWs(): string {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-glob-'));
  fs.mkdirSync(path.join(ws, 'src'));
  fs.writeFileSync(path.join(ws, 'src', 'a.ts'), 'a');
  fs.writeFileSync(path.join(ws, 'src', 'b.txt'), 'b');
  fs.writeFileSync(path.join(ws, 'root.md'), 'r');
  return ws;
}

describe('glob_files tool', () => {
  it('matches files recursively by pattern', async () => {
    const ws = makeWs();
    const res = await globFilesTool.execute({ pattern: '**/*.ts' }, { workspaceRoot: ws });
    expect(res.success).toBe(true);
    expect(res.content).toContain('a.ts');
    expect(res.content).not.toContain('b.txt');
  });

  it('matches only the root with a shallow pattern', async () => {
    const ws = makeWs();
    const res = await globFilesTool.execute({ pattern: '*.md' }, { workspaceRoot: ws });
    expect(res.success).toBe(true);
    expect(res.content).toContain('root.md');
    expect(res.content).not.toContain('a.ts');
  });

  it('returns an empty result for no matches', async () => {
    const ws = makeWs();
    const res = await globFilesTool.execute({ pattern: '**/*.zzz' }, { workspaceRoot: ws });
    expect(res.success).toBe(true);
    expect(res.content).toBe('');
  });

  it('does not list files outside the workspace via ..', async () => {
    const ws = makeWs();
    const outside = path.join(os.tmpdir(), 'agent-glob-outside.txt');
    fs.writeFileSync(outside, 'secret');
    // Whether fast-glob resolves ".." or the sandbox filters it, the outside
    // file must never appear in the result.
    const res = await globFilesTool.execute({ pattern: '../agent-glob-outside.txt' }, { workspaceRoot: ws });
    expect(res.content).not.toContain('agent-glob-outside.txt');
  });

  it('does not list sensitive files (e.g. id_rsa)', async () => {
    const ws = makeWs();
    fs.writeFileSync(path.join(ws, 'id_rsa'), 'KEY');
    const res = await globFilesTool.execute({ pattern: '**/*' }, { workspaceRoot: ws });
    expect(res.content).not.toContain('id_rsa');
  });
});
