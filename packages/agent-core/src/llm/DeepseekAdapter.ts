import type { ChatMessage, LLMChunk, ToolCall, ToolDefinition } from '@minimal-agent/shared-types';
import type { LLMAdapter, LLMRequestOptions } from './LLMAdapter';

const API_URL = 'https://api.deepseek.com/chat/completions';

export interface DeepseekAdapterOptions {
  apiKey: string;
  model: string;
}

// Provider wire types (OpenAI-compatible).
interface ProviderMessage {
  role: string;
  content?: string | null;
  tool_calls?: ProviderToolCall[];
  tool_call_id?: string;
}

interface ProviderToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

interface DeepseekToolCallDelta {
  index?: number;
  id?: string;
  function?: { name?: string; arguments?: string };
}

interface DeepseekDelta {
  content?: string | null;
  tool_calls?: DeepseekToolCallDelta[];
}

interface DeepseekPayload {
  choices?: Array<{
    delta?: DeepseekDelta;
    message?: {
      content?: string | null;
      tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: string } }>;
    };
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

export class DeepseekAdapter implements LLMAdapter {
  constructor(private readonly options: DeepseekAdapterOptions) {}

  async *chat(messages: ChatMessage[], opts: LLMRequestOptions): AsyncIterable<LLMChunk> {
    const body: Record<string, unknown> = {
      model: this.options.model,
      messages: toProviderMessages(messages),
      stream: opts.stream ?? false,
    };
    if (opts.tools && opts.tools.length > 0) {
      body.tools = toProviderTools(opts.tools);
    }

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.options.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Deepseek API error ${response.status}: ${text}`);
    }

    // Non-streaming path (kept for completeness; the loop always streams).
    if (!opts.stream) {
      const payload = (await response.json()) as DeepseekPayload;
      const message = payload.choices?.[0]?.message;
      if (message?.content) yield { textDelta: message.content };
      if (message?.tool_calls) yield { toolCalls: message.tool_calls.map(fromProviderToolCall) };
      return;
    }

    if (!response.body) throw new Error('Deepseek API returned no body');

    // TEACHING: Streaming responses arrive as Server-Sent Events (SSE). Each
    // line starts with "data: " and the stream ends with "data: [DONE]".
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    const toolCallAccumulator = new Map<number, DeepseekToolCallDelta>();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') continue;

        let payload: DeepseekPayload;
        try {
          payload = JSON.parse(data) as DeepseekPayload;
        } catch {
          continue; // ignore keep-alive / malformed lines
        }

        const delta = payload.choices?.[0]?.delta;
        if (delta?.content) yield { textDelta: delta.content };
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const index = tc.index ?? 0;
            const acc = toolCallAccumulator.get(index) ?? {};
            if (tc.id) acc.id = tc.id;
            if (tc.function?.name) acc.function = { ...acc.function, name: tc.function.name };
            if (tc.function?.arguments) {
              acc.function = { ...acc.function, arguments: (acc.function?.arguments ?? '') + tc.function.arguments };
            }
            toolCallAccumulator.set(index, acc);
          }
        }
        if (payload.usage) {
          yield {
            usage: {
              inputTokens: payload.usage.prompt_tokens ?? 0,
              outputTokens: payload.usage.completion_tokens ?? 0,
            },
          };
        }
      }
    }

    // Tool calls arrive fragmented across SSE deltas; assemble them at the end.
    const toolCalls = [...toolCallAccumulator.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, tc]) => fromProviderToolCallDelta(tc));
    if (toolCalls.length > 0) yield { toolCalls };
  }
}

function toProviderMessages(messages: ChatMessage[]): ProviderMessage[] {
  return messages.map((m) => {
    const out: ProviderMessage = { role: m.role, content: m.content ?? '' };
    if (m.toolCallId) out.tool_call_id = m.toolCallId;
    if (m.toolCalls) {
      out.tool_calls = m.toolCalls.map((tc) => ({
        id: tc.id,
        type: 'function' as const,
        function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
      }));
    }
    return out;
  });
}

function toProviderTools(tools: ToolDefinition[]): Array<{ type: 'function'; function: ToolDefinition }> {
  return tools.map((t) => ({ type: 'function' as const, function: t }));
}

function fromProviderToolCall(tc: { id?: string; function?: { name?: string; arguments?: string } }): ToolCall {
  return {
    id: tc.id ?? '',
    name: tc.function?.name ?? '',
    arguments: parseArguments(tc.function?.arguments),
  };
}

function fromProviderToolCallDelta(tc: DeepseekToolCallDelta): ToolCall {
  return {
    id: tc.id ?? '',
    name: tc.function?.name ?? '',
    arguments: parseArguments(tc.function?.arguments),
  };
}

function parseArguments(raw?: string): Record<string, unknown> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { __raw: raw };
  }
}
