import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { writeFileTool } from '../src/tools/implementations/writeFile';

function makeWs(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'agent-write-'));
}

const approve = async () => true;
const deny = async () => false;

describe('write_file tool', () => {
  it('creates a new file when approved', async () => {
    const ws = makeWs();
    const res = await writeFileTool.execute({ path: 'new.txt', content: 'hello' }, { workspaceRoot: ws, approveWrite: approve });
    expect(res.success).toBe(true);
    expect(fs.readFileSync(path.join(ws, 'new.txt'), 'utf-8')).toBe('hello');
  });

  it('creates parent directories as needed', async () => {
    const ws = makeWs();
    await writeFileTool.execute({ path: 'a/b/c.txt', content: 'x' }, { workspaceRoot: ws, approveWrite: approve });
    expect(fs.readFileSync(path.join(ws, 'a', 'b', 'c.txt'), 'utf-8')).toBe('x');
  });

  it('overwrites an existing file when approved', async () => {
    const ws = makeWs();
    fs.writeFileSync(path.join(ws, 'f.txt'), 'old');
    const res = await writeFileTool.execute({ path: 'f.txt', content: 'new' }, { workspaceRoot: ws, approveWrite: approve });
    expect(res.success).toBe(true);
    expect(fs.readFileSync(path.join(ws, 'f.txt'), 'utf-8')).toBe('new');
  });

  it('reports whether the file already exists to the approver', async () => {
    const ws = makeWs();
    const seen: { path: string; exists: boolean }[] = [];
    await writeFileTool.execute(
      { path: 'f.txt', content: 'x' },
      { workspaceRoot: ws, approveWrite: async (req) => { seen.push({ path: req.path, exists: req.exists }); return true; } },
    );
    expect(seen).toEqual([{ path: 'f.txt', exists: false }]);
  });

  it('does not write when approval is denied', async () => {
    const ws = makeWs();
    const res = await writeFileTool.execute({ path: 'f.txt', content: 'x' }, { workspaceRoot: ws, approveWrite: deny });
    expect(res.success).toBe(false);
    expect(res.error).toContain('rejected');
    expect(fs.existsSync(path.join(ws, 'f.txt'))).toBe(false);
  });

  it('denies when no approval handler is configured (fail-safe)', async () => {
    const ws = makeWs();
    const res = await writeFileTool.execute({ path: 'f.txt', content: 'x' }, { workspaceRoot: ws });
    expect(res.success).toBe(false);
    expect(fs.existsSync(path.join(ws, 'f.txt'))).toBe(false);
  });

  it('blocks writing outside the workspace', async () => {
    const ws = makeWs();
    const res = await writeFileTool.execute({ path: '../outside.txt', content: 'x' }, { workspaceRoot: ws, approveWrite: approve });
    expect(res.success).toBe(false);
  });
});
