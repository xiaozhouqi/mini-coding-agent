import type { ToolCall } from './tool';

// Messages as the agent/LLM layer sees them (provider-agnostic). The adapter
// maps these to a provider's wire format.
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface LLMChunk {
  textDelta?: string;
  toolCalls?: ToolCall[];
  usage?: TokenUsage;
}
