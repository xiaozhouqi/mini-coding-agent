// TEACHING: Command security boundary. The shell is powerful and irreversible,
// so — like ToolSandbox for paths — a command is classified *before* it runs,
// in plain code. The model never decides whether a command is safe; the
// classification does.
//
// Responsibility: three-tier classification (safe / approve / blocked), output
// truncation, and the shared timeout/output constants used by run_command.
//
// Dependencies: none (pure functions).
//
// Extension points: add patterns here as new dangerous / networked / interactive
// commands show up. Patterns err toward "approve" (a false positive just asks
// the user) rather than "safe" (a false negative runs something destructive).

export type CommandVerdict = 'safe' | 'approve' | 'blocked';

interface CommandPattern {
  pattern: RegExp;
  label: string;
}

// Never run, even with approval. These are irreversible (system power, disk
// format, fork bombs, deleting a filesystem root) or need a TTY the agent does
// not have (interactive editors/viewers).
const BLOCKED_COMMAND_PATTERNS: CommandPattern[] = [
  { pattern: /\b(shutdown|reboot|poweroff|halt)\b/i, label: 'system power command' },
  { pattern: /\b(format|mkfs)\b/i, label: 'disk format' },
  { pattern: /\bdd\b.*\bof=\/dev\//i, label: 'raw disk write' },
  { pattern: /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/, label: 'fork bomb' },
  { pattern: /\brm\s+(-[a-zA-Z]+\s+)*-\s*[rf]{1,2}\s+\/\*?(\s|$)/i, label: 'delete of filesystem root' },
  { pattern: /\b(?:del|erase)\s+\/[fsq]\b.*\b[a-z]:\\\*(\s|$)/i, label: 'delete of drive root' },
  { pattern: /\brd\s+\/s\s+\/q\s+[a-z]:\\(\s|$)/i, label: 'remove of drive root' },
  { pattern: /\b(vim|nano|emacs|less|more|top|htop|ssh)\b/i, label: 'interactive program (needs a TTY)' },
];

// Run only with user approval. Destructive file changes, force/irreversible git
// operations, and — because the project forbids external network except the LLM
// API — anything that reaches the network.
const APPROVE_COMMAND_PATTERNS: CommandPattern[] = [
  { pattern: /(^|\s)rm(\s|$)/i, label: 'file deletion' },
  { pattern: /\brmdir\b/i, label: 'directory removal' },
  { pattern: /\b(?:del|erase)\b/i, label: 'file deletion (Windows)' },
  { pattern: /\brd\b/i, label: 'directory removal (Windows)' },
  { pattern: /\bgit\s+(reset\s+--hard|clean\s+-f|checkout\s+--)\b/i, label: 'destructive git command' },
  { pattern: /\bgit\s+push\b.*\b(-f|--force)\b/i, label: 'force push' },
  { pattern: /\b(curl|wget)\b/i, label: 'network request' },
  { pattern: /\bgit\s+(clone|fetch|pull|push)\b/i, label: 'network git operation' },
  { pattern: /\b(npm|pnpm|yarn)\s+(install|i|add|publish|update)\b/i, label: 'package install/publish' },
  { pattern: /\bpip\s+(install|download)\b/i, label: 'package install' },
  { pattern: /\bnpx\b/i, label: 'npx (may download)' },
  { pattern: /\bchmod\s+777\b/i, label: 'world-writable permissions' },
];

export function classifyCommand(command: string): { verdict: CommandVerdict; reason?: string } {
  for (const { pattern, label } of BLOCKED_COMMAND_PATTERNS) {
    if (pattern.test(command)) return { verdict: 'blocked', reason: label };
  }
  for (const { pattern, label } of APPROVE_COMMAND_PATTERNS) {
    if (pattern.test(command)) return { verdict: 'approve', reason: label };
  }
  return { verdict: 'safe' };
}

// Timeout and output budget for run_command. Shared constants so the tool and
// its tests agree, and so a future config surface can lift them out.
export const DEFAULT_COMMAND_TIMEOUT_MS = 60_000;
export const OUTPUT_LIMIT = 20_000;
const HEAD_CHARS = 12_000;
const TAIL_CHARS = 8_000;

// TEACHING: Keep the head (start of output) and the tail (where test failures
// usually print their assertion) so the model still sees the important parts
// after a huge build/test dump is truncated.
export function truncateOutput(text: string): string {
  if (text.length <= OUTPUT_LIMIT) return text;
  const dropped = text.length - HEAD_CHARS - TAIL_CHARS;
  return `${text.slice(0, HEAD_CHARS)}\n[... truncated ${dropped} chars ...]\n${text.slice(-TAIL_CHARS)}`;
}
