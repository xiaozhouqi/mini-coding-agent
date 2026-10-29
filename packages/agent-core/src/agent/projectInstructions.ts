import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';

// Responsibility: load the project's instruction file (AGENTS.md, falling back
// to CLAUDE.md) from the workspace root so it can be injected into the system
// prompt. This is the agent's own config loading, not a model-driven tool call,
// so it bypasses the sandbox and desensitization — the file is trusted project
// configuration.
//
// Teaching concept: convention-over-configuration project instructions. The
// file is read once at session init and re-injected every turn, so it survives
// conversation compaction (unlike chat history, which gets summarized).
//
// Extension points: nested / parent-directory AGENTS.md lookup and a size cap
// are deliberately deferred to keep the first cut minimal.
const PROJECT_INSTRUCTION_FILES = ['AGENTS.md', 'CLAUDE.md'];

export function readProjectInstructions(workspaceRoot: string): string {
  for (const fileName of PROJECT_INSTRUCTION_FILES) {
    const filePath = path.join(workspaceRoot, fileName);
    if (existsSync(filePath)) {
      return readFileSync(filePath, 'utf-8');
    }
  }
  return '';
}
