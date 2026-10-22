import { existsSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LLMChunk } from '@minimal-agent/shared-types';
import { DeepseekAdapter } from '../src/llm/DeepseekAdapter';

// Load .env so the live test can find DEEPSEEK_API_KEY. A missing or malformed
// .env is fine: the live test simply skips when no key is present.
if (existsSync('.env')) {
  try {
    process.loadEnvFile('.env');
  } catch {
    // ignore
  }
}

// Build an SSE response body from a list of payload objects.
function sse(...events: object[]): string {
  return events.map((e) => `data: ${JSON.stringify(e)}`).join('\n') + '\ndata: [DONE]\n';
}

async function collectChunks(iterable: AsyncIterable<LLMChunk>): Promise<LLMChunk[]> {
  const chunks: LLMChunk[] = [];
  for await (const chunk of iterable) chunks.push(chunk);
  return chunks;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('DeepseekAdapter (mocked fetch)', () => {
  it('streams text deltas and assembles fragmented tool calls', async () => {
    const stream = sse(
      { choices: [{ delta: { content: 'Hello' } }] },
      { choices: [{ delta: { content: ' world' } }] },
      { choices: [{ delta: { tool_calls: [{ index: 0, id: 'call_1', function: { name: 'read_file', arguments: '{"path":' } }] } }] },
      { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '"a.txt"}' } }] } }] },
      { choices: [{ delta: {} }], usage: { prompt_tokens: 10, completion_tokens: 5 } },
    );
    vi.stubGlobal('fetch', vi.fn(async () => new Response(stream, { status: 200 })));

    const adapter = new DeepseekAdapter({ apiKey: 'test', model: 'deepseek-chat' });
    const chunks = await collectChunks(adapter.chat([{ role: 'user', content: 'read a.txt' }], { stream: true }));

    const text = chunks.filter((c) => c.textDelta).map((c) => c.textDelta).join('');
    expect(text).toBe('Hello world');

    const toolCallChunk = chunks.find((c) => c.toolCalls);
    expect(toolCallChunk?.toolCalls).toHaveLength(1);
    expect(toolCallChunk?.toolCalls?.[0]).toMatchObject({
      id: 'call_1',
      name: 'read_file',
      arguments: { path: 'a.txt' },
    });

    expect(chunks.find((c) => c.usage)?.usage).toEqual({ inputTokens: 10, outputTokens: 5 });
  });

  it('sends the correct request body, tools, and auth header', async () => {
    let body: Record<string, unknown> = {};
    let auth = '';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: unknown, init?: RequestInit) => {
        body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        const headers = init?.headers as Record<string, string>;
        auth = headers.Authorization ?? '';
        return new Response('data: [DONE]\n', { status: 200 });
      }),
    );

    const adapter = new DeepseekAdapter({ apiKey: 'sk-test', model: 'deepseek-chat' });
    const tools = [{ name: 'read_file', description: 'Read a file', parameters: { type: 'object', properties: {} } }];
    const chunks = await collectChunks(adapter.chat([{ role: 'user', content: 'hi' }], { stream: true, tools }));

    expect(chunks).toEqual([]);
    expect(auth).toBe('Bearer sk-test');
    expect(body.model).toBe('deepseek-chat');
    expect(body.stream).toBe(true);
    expect(body.messages).toEqual([{ role: 'user', content: 'hi' }]);
    expect(body.tools).toEqual([{ type: 'function', function: tools[0] }]);
  });

  it('throws on a non-OK response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('bad key', { status: 401 })));
    const adapter = new DeepseekAdapter({ apiKey: 'bad', model: 'deepseek-chat' });
    const result = collectChunks(adapter.chat([{ role: 'user', content: 'hi' }], { stream: true }));
    await expect(result).rejects.toThrow(/401/);
  });
});

// Live integration test — runs only when DEEPSEEK_API_KEY is present.
const apiKey = process.env.DEEPSEEK_API_KEY;
describe.skipIf(!apiKey)('DeepseekAdapter (live)', () => {
  it('streams a plain-text reply from the real API', async () => {
    const adapter = new DeepseekAdapter({ apiKey: apiKey!, model: 'deepseek-chat' });
    const chunks = await collectChunks(
      adapter.chat([{ role: 'user', content: 'Reply with exactly one word: ok' }], { stream: true }),
    );
    const text = chunks.filter((c) => c.textDelta).map((c) => c.textDelta).join('').trim();
    expect(text.length).toBeGreaterThan(0);
    // Case-insensitive so "OK"/"Ok"/"ok."/"Okay" all pass; exact match would be flaky.
    expect(text).toMatch(/ok/i);
  }, 30000);
});
