import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import * as fs from 'node:fs';
import type { Tool, ToolContext, ToolResult } from '@minimal-agent/shared-types';
import { desensitize } from '../../security/desensitize';
import { classifyCommand, DEFAULT_COMMAND_TIMEOUT_MS, truncateOutput } from '../CommandSandbox';

// TEACHING: run_command closes the ReAct loop — the agent can now run a command
// (tests, builds, a script) and *observe the result* to correct itself. It is
// also the highest-trust tool, so it is the most heavily guarded: classification
// (safe/approve/blocked) + timeout + output truncation + desensitization.
export const runCommandTool: Tool = {
  definition: {
    name: 'run_command',
    description:
      'Run a shell command in the workspace. Safe commands run immediately; destructive or network commands require user approval; some commands are always blocked.',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The shell command, executed from the workspace root.' },
      },
      required: ['command'],
    },
  },

  async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const command = params.command;
    if (typeof command !== 'string' || command.trim() === '') {
      return { success: false, content: '', error: 'run_command requires a non-empty "command" argument' };
    }

    const { verdict, reason } = classifyCommand(command);
    if (verdict === 'blocked') {
      return { success: false, content: '', error: `Command blocked (${reason}): ${command}` };
    }
    if (verdict === 'approve') {
      // Fail-safe: no approver configured -> deny, mirroring write_file.
      if (!context.approveCommand) {
        return { success: false, content: '', error: 'run_command requires an approval handler for this command' };
      }
      const approved = await context.approveCommand({ command, reason: reason ?? 'requires approval' });
      if (!approved) {
        return { success: false, content: '', error: 'Command rejected by user' };
      }
    }

    const workspaceRoot = fs.realpathSync(context.workspaceRoot);
    const timeoutMs = context.commandTimeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS;

    return runShellCommand(command, workspaceRoot, timeoutMs);
  },
};

// Run a command through the platform shell. Node's `shell: true` picks cmd.exe
// on Windows and /bin/sh elsewhere, and handles quoting of the single command
// string — we only classify the command, not the shell.
function runShellCommand(command: string, cwd: string, timeoutMs: number): Promise<ToolResult> {
  return new Promise((resolve) => {
    const child = spawn(command, {
      shell: true,
      cwd,
      windowsHide: true,
      // stdin is ignored so an interactive prompt reads EOF instead of hanging.
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const finish = (result: ToolResult): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    // TEACHING: the timeout is a hard boundary, not a suggestion. Kill the whole
    // process tree (a shell can spawn grandchildren) so a hung test cannot leak.
    const timer = setTimeout(() => {
      killTree(child);
      finish({ success: false, content: '', error: `Command timed out after ${timeoutMs}ms` });
    }, timeoutMs);

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on('error', (err) => {
      finish({ success: false, content: '', error: err.message });
    });

    child.on('close', (code) => {
      const combined = stderr ? `${stdout}\n${stderr}` : stdout;
      // A non-zero exit is an observation, not a tool error: the model needs the
      // real output to self-correct, so this is always success:true.
      finish({ success: true, content: `[exit code ${code ?? 'signal'}]\n${desensitize(truncateOutput(combined))}` });
    });
  });
}

// Best-effort tree kill. On Windows the shell (cmd.exe) spawns grandchildren, so
// killing only the direct child would leave `pnpm test`'s node process running.
function killTree(child: ChildProcess): void {
  if (child.pid && process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true });
  }
  child.kill('SIGKILL');
}
