import * as fs from 'node:fs/promises';
import type { Tool, ToolContext, ToolResult } from '@minimal-agent/shared-types';
import { isSensitivePath, resolveSafePath } from '../ToolSandbox';

// TEACHING: A tool = definition (what the LLM sees) + execute (what it does).
export const readFileTool: Tool = {
  definition: {
    name: 'read_file',
    description: 'Read the contents of a text file inside the workspace.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path relative to the workspace root.' },
      },
      required: ['path'],
    },
  },

  async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const inputPath = params.path;
    if (typeof inputPath !== 'string' || inputPath.length === 0) {
      return { success: false, content: '', error: 'read_file requires a non-empty "path" argument' };
    }

    try {
      const realPath = resolveSafePath(context.workspaceRoot, inputPath);
      if (isSensitivePath(realPath)) {
        return { success: false, content: '', error: `Access denied: sensitive file blocked (${inputPath})` };
      }
      const content = await fs.readFile(realPath, 'utf-8');
      return { success: true, content };
    } catch (err) {
      // Return the failure as a ToolResult so the loop can feed it back to the
      // model rather than crashing.
      return { success: false, content: '', error: err instanceof Error ? err.message : String(err) };
    }
  },
};
