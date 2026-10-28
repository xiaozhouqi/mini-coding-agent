import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { ChatMessage, LLMChunk, ToolCall } from '@minimal-agent/shared-types';
import type { LLMAdapter, LLMRequestOptions } from '../src/llm/LLMAdapter';
import { AgentLoop } from '../src/agent/AgentLoop';
import type { AgentStreamEvent } from '../src/agent/AgentLoop';
import { PromptManager } from '../src/agent/PromptManager';
import { createToolExecutor } from '../src/tools/registry';

// A scripted adapter so the loop is tested without a network or API key.
class FakeLLMAdapter implements LLMAdapter {
  constructor(private readonly script: (messages: ChatMessage[]) => LLMChunk[]) {}

  async *chat(messages: ChatMessage[], _opts: LLMRequestOptions): AsyncIterable<LLMChunk> {
    for (const chunk of this.script(messages)) yield chunk;
  }
}

function makeWorkspace(): string {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-loop-'));
  fs.writeFileSync(path.join(ws, 'hello.txt'), 'hello world');
  return ws;
}

async function collect(loop: AgentLoop, message: string, ws: string): Promise<AgentStreamEvent[]> {
  const events: AgentStreamEvent[] = [];
  for await (const e of loop.run(message, ws)) events.push(e);
  return events;
}

describe('AgentLoop', () => {
  it('completes one ReAct iteration: tool call -> result -> final answer', async () => {
    const ws = makeWorkspace();
    const readCall: ToolCall = { id: 'call_1', name: 'read_file', arguments: { path: 'hello.txt' } };

    let turn = 0;
    const llm = new FakeLLMAdapter((messages) => {
      turn += 1;
      if (turn === 1) {
        expect(messages[messages.length - 1].role).toBe('user');
        return [{ toolCalls: [readCall] }];
      }
      const toolMsg = messages.find((m) => m.role === 'tool');
      expect(toolMsg?.content).toContain('hello world');
      return [{ textDelta: 'The file says hello world.' }];
    });

    const loop = new AgentLoop(llm, createToolExecutor(), new PromptManager());
    const events = await collect(loop, 'what is in hello.txt?', ws);

    expect(events.map((e) => e.type)).toEqual(['tool-call', 'tool-result', 'text-delta', 'done']);
    expect(events.find((e) => e.type === 'tool-result')?.toolResult?.success).toBe(true);
  });

  it('blocks a sensitive file and feeds the error back to the model', async () => {
    const ws = makeWorkspace();
    fs.writeFileSync(path.join(ws, '.env'), 'SECRET=1');

    let turn = 0;
    const llm = new FakeLLMAdapter(() => {
      turn += 1;
      if (turn === 1) {
        return [{ toolCalls: [{ id: 'call_1', name: 'read_file', arguments: { path: '.env' } }] }];
      }
      return [{ textDelta: 'I cannot read that file.' }];
    });

    const loop = new AgentLoop(llm, createToolExecutor(), new PromptManager());
    const events = await collect(loop, 'read .env', ws);

    const result = events.find((e) => e.type === 'tool-result')?.toolResult;
    expect(result?.success).toBe(false);
    expect(result?.error).toContain('sensitive');
  });

  it('runs write_file through approval and writes the file', async () => {
    const ws = makeWorkspace();
    const approvedPaths: string[] = [];

    let turn = 0;
    const llm = new FakeLLMAdapter(() => {
      turn += 1;
      if (turn === 1) {
        return [{ toolCalls: [{ id: 'call_1', name: 'write_file', arguments: { path: 'out.txt', content: 'written' } }] }];
      }
      return [{ textDelta: 'Done.' }];
    });

    const loop = new AgentLoop(llm, createToolExecutor(), new PromptManager());
    const events: AgentStreamEvent[] = [];
    for await (const e of loop.run('write out.txt', ws, [], async (req) => {
      approvedPaths.push(req.path);
      return true;
    })) {
      events.push(e);
    }

    expect(approvedPaths).toEqual(['out.txt']);
    expect(events.find((e) => e.type === 'tool-result')?.toolResult?.success).toBe(true);
    expect(fs.readFileSync(path.join(ws, 'out.txt'), 'utf-8')).toBe('written');
  });

  it('runs run_command through approval and observes the result', async () => {
    const ws = makeWorkspace();
    const approvedCommands: string[] = [];

    let turn = 0;
    const llm = new FakeLLMAdapter(() => {
      turn += 1;
      if (turn === 1) {
        return [{ toolCalls: [{ id: 'call_1', name: 'run_command', arguments: { command: 'rm -rf no-such-dir' } }] }];
      }
      return [{ textDelta: 'Done.' }];
    });

    const loop = new AgentLoop(llm, createToolExecutor(), new PromptManager());
    const events: AgentStreamEvent[] = [];
    for await (const e of loop.run('clean up', ws, [], undefined, async (req) => {
      approvedCommands.push(req.command);
      return true;
    })) {
      events.push(e);
    }

    expect(approvedCommands).toEqual(['rm -rf no-such-dir']);
    expect(events.find((e) => e.type === 'tool-result')?.toolResult?.success).toBe(true);
  });
});
