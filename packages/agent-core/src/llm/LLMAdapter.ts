import type { ChatMessage, LLMChunk, ToolDefinition } from '@minimal-agent/shared-types';

export interface LLMRequestOptions {
  stream?: boolean;
  tools?: ToolDefinition[];
}

// TEACHING: Adapter boundary — the agent depends on this interface, never on a
// concrete provider. Swap Deepseek for another provider by adding a new class
// that implements it.
export interface LLMAdapter {
  chat(messages: ChatMessage[], options: LLMRequestOptions): AsyncIterable<LLMChunk>;
}
