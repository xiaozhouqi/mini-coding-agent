import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { readFileTool } from '../src/tools/implementations/readFile';

function makeWorkspace(): string {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-readfile-'));
  fs.writeFileSync(path.join(ws, 'ok.txt'), 'content here');
  return ws;
}

describe('read_file tool', () => {
  it('reads a file inside the workspace', async () => {
    const ws = makeWorkspace();
    const res = await readFileTool.execute({ path: 'ok.txt' }, { workspaceRoot: ws });
    expect(res.success).toBe(true);
    expect(res.content).toBe('content here');
  });

  it('blocks a sensitive file', async () => {
    const ws = makeWorkspace();
    fs.writeFileSync(path.join(ws, '.env'), 'SECRET=1');
    const res = await readFileTool.execute({ path: '.env' }, { workspaceRoot: ws });
    expect(res.success).toBe(false);
    expect(res.error).toContain('sensitive');
  });

  it('blocks traversal outside the workspace', async () => {
    const ws = makeWorkspace();
    const res = await readFileTool.execute({ path: '../outside.txt' }, { workspaceRoot: ws });
    expect(res.success).toBe(false);
  });
});
