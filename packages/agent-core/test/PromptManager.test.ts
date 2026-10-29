import { describe, expect, it } from 'vitest';
import { PromptManager } from '../src/agent/PromptManager';

describe('PromptManager', () => {
  it('uses the base prompt alone when no project instructions are present', () => {
    const messages = new PromptManager().buildMessages('hi');
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toContain('minimal coding agent');
    expect(messages[0].content).not.toContain('## Project Instructions');
  });

  it('appends project instructions after the base prompt', () => {
    const instructions = 'Always use pnpm, never npm.';
    const system = new PromptManager(undefined, instructions).buildMessages('hi')[0].content;
    expect(system.indexOf('minimal coding agent')).toBeLessThan(system.indexOf('## Project Instructions'));
    expect(system).toContain(instructions);
  });

  it('keeps stable content first, then history, then the user message', () => {
    const history = [{ role: 'assistant' as const, content: 'prior answer' }];
    const messages = new PromptManager('base', 'instructions').buildMessages('hi', history);
    expect(messages.map((m) => m.role)).toEqual(['system', 'assistant', 'user']);
  });
});
