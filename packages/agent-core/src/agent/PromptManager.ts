import type { ChatMessage } from '@minimal-agent/shared-types';

const DEFAULT_SYSTEM_PROMPT = `You are a minimal coding agent designed for teaching.
You help the user explore and understand files inside their workspace.
Use the read_file tool to inspect files, then answer in plain text.
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
