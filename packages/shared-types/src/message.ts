import type { ToolCall } from './tool';

export type MessageRole = 'user' | 'assistant' | 'tool' | 'system';

export interface BaseMessage {
  id: string;
  role: MessageRole;
  timestamp: number;
}

export interface TextMessage extends BaseMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ToolCallMessage extends BaseMessage {
  role: 'assistant';
  toolCalls: ToolCall[];
}

export interface ToolResultMessage extends BaseMessage {
  role: 'tool';
  toolCallId: string;
  toolName: string;
  content: string;
  isError: boolean;
}

export type Message = TextMessage | ToolCallMessage | ToolResultMessage;
