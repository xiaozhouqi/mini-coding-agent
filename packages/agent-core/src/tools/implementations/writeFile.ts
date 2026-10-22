import { existsSync } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { Tool, ToolContext, ToolResult } from '@minimal-agent/shared-types';
import { resolveSafeWritePath } from '../ToolSandbox';

// TEACHING: A tool = definition (what the LLM sees) + execute (what it does).
// write_file adds a human-in-the-loop safety boundary: it refuses to write
// unless an approveWrite handler is supplied and returns true.
export const writeFileTool: Tool = {
  definition: {
    name: 'write_file',
    description: 'Create or overwrite a file in the workspace. Requires user approval.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path relative to the workspace root.' },
        content: { type: 'string', description: 'Full content to write.' },
      },
      required: ['path', 'content'],
    },
  },

  async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const inputPath = params.path;
    const content = params.content;
    if (typeof inputPath !== 'string' || inputPath.length === 0) {
      return { success: false, content: '', error: 'write_file requires a non-empty "path" argument' };
    }
    if (typeof content !== 'string') {
      return { success: false, content: '', error: 'write_file requires a string "content" argument' };
    }

    try {
      const safePath = resolveSafeWritePath(context.workspaceRoot, inputPath);
      const exists = existsSync(safePath);

      // TEACHING: Fail-safe approval. No approver configured -> deny.
      if (!context.approveWrite) {
        return { success: false, content: '', error: 'write_file requires an approval handler' };
      }
      const approved = await context.approveWrite({ path: inputPath, content, exists });
      if (!approved) {
        return { success: false, content: '', error: 'Write rejected by user' };
      }

      await fs.mkdir(path.dirname(safePath), { recursive: true });
      await fs.writeFile(safePath, content, 'utf-8');
      return { success: true, content: `Wrote ${inputPath} (${content.length} bytes)` };
    } catch (err) {
      return { success: false, content: '', error: err instanceof Error ? err.message : String(err) };
    }
  },
};
