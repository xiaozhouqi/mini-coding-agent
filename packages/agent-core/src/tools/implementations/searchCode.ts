import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import type { Tool, ToolContext, ToolResult } from '@minimal-agent/shared-types';
import { isSensitivePath, resolveSafePath } from '../ToolSandbox';

const MAX_MATCHES = 200;
const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'build']);

export const searchCodeTool: Tool = {
  definition: {
    name: 'search_code',
    description: 'Search file contents in the workspace using a regular expression.',
    parameters: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Regular expression to search for.' },
        path: { type: 'string', description: 'Optional sub-path (dir or file) to search within.' },
      },
      required: ['pattern'],
    },
  },

  async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const pattern = params.pattern;
    const subPath = params.path;
    if (typeof pattern !== 'string' || pattern.length === 0) {
      return { success: false, content: '', error: 'search_code requires a non-empty "pattern" argument' };
    }
    if (subPath !== undefined && (typeof subPath !== 'string' || subPath.length === 0)) {
      return { success: false, content: '', error: 'search_code "path" must be a non-empty string' };
    }

    let regex: RegExp;
    try {
      regex = new RegExp(pattern);
    } catch (err) {
      return { success: false, content: '', error: `Invalid regex: ${err instanceof Error ? err.message : String(err)}` };
    }

    try {
      const root = fs.realpathSync(path.resolve(context.workspaceRoot));
      const searchRoot = subPath ? resolveSafePath(context.workspaceRoot, subPath) : root;

      const files: string[] = [];
      const st = await fsp.stat(searchRoot);
      if (st.isDirectory()) {
        await walkFiles(searchRoot, files);
      } else {
        files.push(searchRoot);
      }

      const results: string[] = [];
      outer: for (const file of files) {
        if (isSensitivePath(file)) continue; // never search secret/key files
        let content: string;
        try {
          content = await fsp.readFile(file, 'utf-8');
        } catch {
          continue; // skip binary / unreadable
        }
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (regex.test(lines[i])) {
            results.push(`${path.relative(root, file)}:${i + 1}: ${lines[i].trim()}`);
            if (results.length >= MAX_MATCHES) break outer;
          }
        }
      }

      return { success: true, content: results.length > 0 ? results.join('\n') : '(no matches)' };
    } catch (err) {
      return { success: false, content: '', error: err instanceof Error ? err.message : String(err) };
    }
  },
};

async function walkFiles(dir: string, out: string[]): Promise<void> {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      await walkFiles(full, out);
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
}
