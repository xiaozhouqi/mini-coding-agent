import type { ChatMessage } from '@minimal-agent/shared-types';

const DEFAULT_SYSTEM_PROMPT = `You are a minimal coding agent designed for teaching.
You help the user explore, understand, and modify files inside their workspace.
Use the read_file / glob_files / search_code tools to inspect files, write_file
(with approval) to modify them, and run_command to run tests or builds and see
the result so you can correct your own work.
Only access paths inside the workspace.`;

export class PromptManager {
  constructor(private readonly systemPrompt: string = DEFAULT_SYSTEM_PROMPT) {}

  buildMessages(userMessage: string, history: ChatMessage[] = []): ChatMessage[] {
    return [
      { role: 'system', content: this.systemPrompt },
      ...history,
      { role: 'user', content: userMessage },
    ];
  }
}
