import * as fs from 'node:fs';
import * as path from 'node:path';
import fg from 'fast-glob';
import type { Tool, ToolContext, ToolResult } from '@minimal-agent/shared-types';
import { isSensitivePath } from '../ToolSandbox';

export const globFilesTool: Tool = {
  definition: {
    name: 'glob_files',
    description: 'Find files in the workspace matching a glob pattern (e.g. "src/**/*.ts").',
    parameters: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Glob pattern, e.g. "**/*.ts" or "src/**/*".' },
      },
      required: ['pattern'],
    },
  },

  async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const pattern = params.pattern;
    if (typeof pattern !== 'string' || pattern.length === 0) {
      return { success: false, content: '', error: 'glob_files requires a non-empty "pattern" argument' };
    }

    try {
      const root = fs.realpathSync(path.resolve(context.workspaceRoot));
      const matches = await fg(pattern, { cwd: root, onlyFiles: true, dot: false });

      // Defensive: drop anything that escaped the workspace (e.g. via "..") and
      // hide sensitive files.
      const safe = matches.filter((m) => {
        const abs = path.resolve(root, m);
        if (abs !== root && !abs.startsWith(root + path.sep)) return false;
        return !isSensitivePath(abs);
      });

      return { success: true, content: safe.join('\n') };
    } catch (err) {
      return { success: false, content: '', error: err instanceof Error ? err.message : String(err) };
    }
  },
};
