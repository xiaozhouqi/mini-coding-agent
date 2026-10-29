import type { ChatMessage } from '@minimal-agent/shared-types';

const DEFAULT_SYSTEM_PROMPT = `You are a minimal coding agent designed for teaching.
You help the user explore, understand, and modify files inside their workspace.
Use the read_file / glob_files / search_code tools to inspect files, write_file
(with approval) to modify them, and run_command to run tests or builds and see
the result so you can correct your own work.
Only access paths inside the workspace.`;

// Responsibility: assemble each turn's system prompt from the base prompt plus
// injected durable context (project instructions today, long-term memory later),
// then place it before history and the current user message.
//
// Teaching concept: prompt composition and stable-prefix ordering — durable
// content goes first so the provider's prefix cache stays warm.
//
// Extension point: P2 appends a `## Memory` section in composeSystemPrompt().
export class PromptManager {
  constructor(
    private readonly systemPrompt: string = DEFAULT_SYSTEM_PROMPT,
    private readonly projectInstructions: string = '',
  ) {}

  buildMessages(userMessage: string, history: ChatMessage[] = []): ChatMessage[] {
    return [
      { role: 'system', content: this.composeSystemPrompt() },
      ...history,
      { role: 'user', content: userMessage },
    ];
  }

  private composeSystemPrompt(): string {
    if (!this.projectInstructions.trim()) return this.systemPrompt;
    return [this.systemPrompt, '## Project Instructions', this.projectInstructions].join('\n\n');
  }
}
