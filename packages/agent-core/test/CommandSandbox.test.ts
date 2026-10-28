import { describe, expect, it } from 'vitest';
import { classifyCommand, truncateOutput } from '../src/tools/CommandSandbox';

describe('classifyCommand', () => {
  it('lets ordinary dev commands run', () => {
    expect(classifyCommand('pnpm test').verdict).toBe('safe');
    expect(classifyCommand('pnpm build').verdict).toBe('safe');
    expect(classifyCommand('node script.js').verdict).toBe('safe');
    expect(classifyCommand('echo hello').verdict).toBe('safe');
  });

  it('flags destructive and network commands for approval', () => {
    expect(classifyCommand('rm -rf node_modules').verdict).toBe('approve');
    expect(classifyCommand('git push --force').verdict).toBe('approve');
    expect(classifyCommand('git reset --hard HEAD').verdict).toBe('approve');
    expect(classifyCommand('curl https://example.com').verdict).toBe('approve');
    expect(classifyCommand('npm install lodash').verdict).toBe('approve');
    expect(classifyCommand('pnpm install').verdict).toBe('approve');
  });

  it('blocks irreversible and interactive commands', () => {
    expect(classifyCommand('shutdown now').verdict).toBe('blocked');
    expect(classifyCommand('rm -rf /').verdict).toBe('blocked');
    expect(classifyCommand('rm -rf /*').verdict).toBe('blocked');
    expect(classifyCommand('vim file.txt').verdict).toBe('blocked');
  });
});

describe('truncateOutput', () => {
  it('keeps short output intact', () => {
    expect(truncateOutput('hello')).toBe('hello');
  });

  it('keeps head and tail for long output', () => {
    const text = 'a'.repeat(30_000);
    const out = truncateOutput(text);
    expect(out).toContain('truncated');
    expect(out.startsWith('a'.repeat(12_000))).toBe(true);
    expect(out.endsWith('a'.repeat(8_000))).toBe(true);
    expect(out.length).toBeLessThan(30_000);
  });
});
