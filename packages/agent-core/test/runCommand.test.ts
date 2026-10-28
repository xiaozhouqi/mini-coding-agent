import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { CommandApprovalRequest, ToolContext } from '@minimal-agent/shared-types';
import { runCommandTool } from '../src/tools/implementations/runCommand';

function makeWorkspace(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'agent-cmd-'));
}

function context(ws: string, overrides: Partial<ToolContext> = {}): ToolContext {
  return { workspaceRoot: ws, ...overrides };
}

describe('runCommandTool', () => {
  it('runs a safe command and returns its output', async () => {
    const ws = makeWorkspace();
    const result = await runCommandTool.execute({ command: 'echo hello' }, context(ws));
    expect(result.success).toBe(true);
    expect(result.content).toContain('hello');
    expect(result.content).toContain('[exit code 0]');
  });

  it('reports a non-zero exit code as a successful observation', async () => {
    const ws = makeWorkspace();
    fs.writeFileSync(path.join(ws, 'exit3.js'), 'process.exit(3);\n');
    const result = await runCommandTool.execute({ command: 'node exit3.js' }, context(ws));
    expect(result.success).toBe(true);
    expect(result.content).toContain('[exit code 3]');
  });

  it('blocks a command on the never-run list without executing it', async () => {
    const ws = makeWorkspace();
    const result = await runCommandTool.execute({ command: 'shutdown now' }, context(ws));
    expect(result.success).toBe(false);
    expect(result.error).toContain('blocked');
  });

  it('denies a dangerous command when no approval handler is configured', async () => {
    const ws = makeWorkspace();
    const result = await runCommandTool.execute({ command: 'rm -rf node_modules' }, context(ws));
    expect(result.success).toBe(false);
    expect(result.error).toContain('approval handler');
  });

  it('rejects a dangerous command when the user denies it', async () => {
    const ws = makeWorkspace();
    const seen: CommandApprovalRequest[] = [];
    const result = await runCommandTool.execute(
      { command: 'rm -rf node_modules' },
      context(ws, {
        approveCommand: async (req) => {
          seen.push(req);
          return false;
        },
      }),
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('rejected');
    expect(seen).toEqual([{ command: 'rm -rf node_modules', reason: 'file deletion' }]);
  });

  it('executes a dangerous command once approved (exit code is still an observation)', async () => {
    const ws = makeWorkspace();
    const seen: CommandApprovalRequest[] = [];
    const result = await runCommandTool.execute(
      { command: 'rm -rf no-such-dir' },
      context(ws, {
        approveCommand: async (req) => {
          seen.push(req);
          return true;
        },
      }),
    );
    // Approved -> the tool attempts execution. It reports tool-level success
    // even though `rm` may not exist on this platform; the exit code is data.
    expect(seen.length).toBe(1);
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('desensitizes secrets in command output', async () => {
    const ws = makeWorkspace();
    fs.writeFileSync(path.join(ws, 'secret.js'), "console.log('api_key=sk-1234567890abcdef');\n");
    const result = await runCommandTool.execute({ command: 'node secret.js' }, context(ws));
    expect(result.success).toBe(true);
    expect(result.content).toContain('api_key=***');
    expect(result.content).not.toContain('sk-1234567890abcdef');
  });

  it('times out and kills a long-running command', async () => {
    const ws = makeWorkspace();
    fs.writeFileSync(path.join(ws, 'hang.js'), 'setTimeout(function () {}, 5000);\n');
    const result = await runCommandTool.execute(
      { command: 'node hang.js' },
      context(ws, { commandTimeoutMs: 500 }),
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('timed out');
  });
});
