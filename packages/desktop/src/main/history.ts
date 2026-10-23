import type { ChatMessage, Message } from '@minimal-agent/shared-types';

// TEACHING: Persistence boundary. The renderer stores human-friendly `Message`
// objects (with ids and timestamps) in JSONL; the agent's loop speaks
// `ChatMessage` (provider-neutral). This maps the stored form back to the form
// the agent understands, so a restored session can continue with full context.

export function messagesToChatHistory(messages: Message[]): ChatMessage[] {
  const history: ChatMessage[] = [];
  for (const msg of messages) {
    switch (msg.role) {
      case 'user':
        history.push({ role: 'user', content: msg.content });
        break;
      case 'assistant':
        // A ToolCallMessage has no text content; a TextMessage does.
        if ('toolCalls' in msg) {
          history.push({ role: 'assistant', content: '', toolCalls: msg.toolCalls });
        } else {
          history.push({ role: 'assistant', content: msg.content });
        }
        break;
      case 'tool':
        history.push({ role: 'tool', toolCallId: msg.toolCallId, content: msg.content });
        break;
      // Note: there is no 'system' case. Stored messages never carry a system
      // role — system prompts are injected by the PromptManager, not persisted.
    }
  }
  return history;
}
