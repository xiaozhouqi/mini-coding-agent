import { describe, expect, it } from 'vitest';
import type { AgentConfig, ChatMessage, OutputFrame, ToolCall } from '@minimal-agent/shared-types';
import type { AgentStreamEvent } from '../src/agent/AgentLoop';
import { StdioAgentServer, reconstructTurn } from '../src/stdio-server';
import type { LoopLike } from '../src/stdio-server';

const CONFIG: AgentConfig = { apiKey: 'test-key', model: 'deepseek-v4-pro', tokenBudget: 100000, systemPrompt: '' };

const WRITE_CALL: ToolCall = { id: 'c1', name: 'write_file', arguments: { path: 'a.txt', content: 'x' } };

// A scripted loop that mimics the write_file approval round trip: yield the
// tool call, ask the parent for approval, then yield the result.
function makeApprovingLoop(): LoopLike {
  return {
    totalTokens: 7,
    async *run(_msg, _ws, _history, approveWrite) {
      yield { type: 'text-delta', text: 'thinking...' };
      yield { type: 'tool-call', toolCall: WRITE_CALL };
      const ok = approveWrite
        ? await approveWrite({ path: 'a.txt', content: 'x', exists: false })
        : false;
      yield {
        type: 'tool-result',
        toolResult: ok
          ? { success: true, content: 'Wrote a.txt' }
          : { success: false, content: '', error: 'Write rejected by user' },
      };
      yield { type: 'done' };
    },
  };
}

describe('reconstructTurn', () => {
  it('returns an empty history for no events', () => {
    expect(reconstructTurn([])).toEqual([]);
  });

  it('turns plain text into a single assistant message', () => {
    const events: AgentStreamEvent[] = [
      { type: 'text-delta', text: 'Hello' },
      { type: 'text-delta', text: ' world' },
    ];
    expect(reconstructTurn(events)).toEqual([{ role: 'assistant', content: 'Hello world' }]);
  });

  it('reconstructs one tool-using turn followed by a final answer', () => {
    const events: AgentStreamEvent[] = [
      { type: 'text-delta', text: 'Let me check.' },
      { type: 'tool-call', toolCall: { id: 'c1', name: 'read_file', arguments: { path: 'a.txt' } } },
      { type: 'tool-result', toolResult: { success: true, content: 'file contents' } },
      { type: 'text-delta', text: 'The file says file contents.' },
    ];
    expect(reconstructTurn(events)).toEqual<ChatMessage[]>([
      { role: 'assistant', content: 'Let me check.', toolCalls: [{ id: 'c1', name: 'read_file', arguments: { path: 'a.txt' } }] },
      { role: 'tool', toolCallId: 'c1', content: 'file contents' },
      { role: 'assistant', content: 'The file says file contents.' },
    ]);
  });

  it('groups multiple tool calls from one turn under a single assistant message', () => {
    const events: AgentStreamEvent[] = [
      { type: 'tool-call', toolCall: { id: 'c1', name: 'read_file', arguments: { path: 'a' } } },
      { type: 'tool-result', toolResult: { success: true, content: 'A' } },
      { type: 'tool-call', toolCall: { id: 'c2', name: 'read_file', arguments: { path: 'b' } } },
      { type: 'tool-result', toolResult: { success: true, content: 'B' } },
      { type: 'text-delta', text: 'done' },
    ];
    expect(reconstructTurn(events)).toEqual<ChatMessage[]>([
      {
        role: 'assistant',
        content: '',
        toolCalls: [
          { id: 'c1', name: 'read_file', arguments: { path: 'a' } },
          { id: 'c2', name: 'read_file', arguments: { path: 'b' } },
        ],
      },
      { role: 'tool', toolCallId: 'c1', content: 'A' },
      { role: 'tool', toolCallId: 'c2', content: 'B' },
      { role: 'assistant', content: 'done' },
    ]);
  });

  it('prefixes failed tool results with the error text', () => {
    const events: AgentStreamEvent[] = [
      { type: 'tool-call', toolCall: { id: 'c1', name: 'read_file', arguments: { path: 'x' } } },
      { type: 'tool-result', toolResult: { success: false, content: '', error: 'not found' } },
    ];
    expect(reconstructTurn(events)).toEqual<ChatMessage[]>([
      { role: 'assistant', content: '', toolCalls: [{ id: 'c1', name: 'read_file', arguments: { path: 'x' } }] },
      { role: 'tool', toolCallId: 'c1', content: 'Error: not found' },
    ]);
  });
});

describe('StdioAgentServer', () => {
  it('runs a message and routes the write approval to approval and success', async () => {
    const frames: OutputFrame[] = [];
    const server = new StdioAgentServer({
      write: (frame) => {
        frames.push(frame);
        if (frame.type === 'approval-request') {
          void server.handle({ type: 'approval-result', approved: true });
        }
      },
      createLoop: () => makeApprovingLoop(),
    });

    await server.handle({ type: 'init', config: CONFIG, workspace: '/ws' });
    await server.handle({ type: 'user-message', content: 'write a.txt' });

    expect(frames.map((f) => f.type)).toEqual(['text-delta', 'tool-call', 'approval-request', 'tool-result', 'done']);
    const result = frames.find((f) => f.type === 'tool-result');
    expect(result?.type === 'tool-result' && result.toolResult.success).toBe(true);
    const done = frames.find((f) => f.type === 'done');
    expect(done?.type === 'done' && done.tokenUsage).toBe(7);
  });

  it('feeds a rejected write back to the loop as a failed tool result', async () => {
    const frames: OutputFrame[] = [];
    const server = new StdioAgentServer({
      write: (frame) => {
        frames.push(frame);
        if (frame.type === 'approval-request') {
          void server.handle({ type: 'approval-result', approved: false, reason: 'no' });
        }
      },
      createLoop: () => makeApprovingLoop(),
    });

    await server.handle({ type: 'init', config: CONFIG, workspace: '/ws' });
    await server.handle({ type: 'user-message', content: 'write a.txt' });

    const result = frames.find((f) => f.type === 'tool-result');
    expect(result?.type === 'tool-result' && result.toolResult.success).toBe(false);
  });

  it('errors when a message arrives before init', async () => {
    const frames: OutputFrame[] = [];
    const server = new StdioAgentServer({ write: (f) => frames.push(f) });
    await server.handle({ type: 'user-message', content: 'hi' });
    expect(frames).toEqual([{ type: 'error', message: 'Agent not initialized (no init frame)' }]);
  });

  it('rejects a second message while the loop is busy', async () => {
    let release: ((ok: boolean) => void) | undefined;
    const loop: LoopLike = {
      async *run() {
        yield { type: 'tool-call', toolCall: WRITE_CALL };
        // Park forever until released — simulates a long-running turn.
        await new Promise<boolean>((r) => {
          release = r;
        });
        yield { type: 'done' };
      },
    };
    const frames: OutputFrame[] = [];
    const server = new StdioAgentServer({ write: (f) => frames.push(f), createLoop: () => loop });

    await server.handle({ type: 'init', config: CONFIG, workspace: '/ws' });
    const first = server.handle({ type: 'user-message', content: 'one' });
    await new Promise((r) => setTimeout(r, 0)); // let the loop reach the park

    await server.handle({ type: 'user-message', content: 'two' });
    expect(frames.some((f) => f.type === 'error' && f.message === 'Agent is busy')).toBe(true);

    release?.(true);
    await first;
  });
});
