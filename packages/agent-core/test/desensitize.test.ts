import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { desensitize } from '../src/security/desensitize';
import { readFileTool } from '../src/tools/implementations/readFile';
import { searchCodeTool } from '../src/tools/implementations/searchCode';

describe('desensitize', () => {
  it('masks bare sk- API keys', () => {
    expect(desensitize('key=sk-abc123def4567890')).toBe('key=sk-***');
    expect(desensitize('sk-ABCDEFGHIJKLMNOP')).toBe('sk-***');
  });

  it('masks common secret field assignments', () => {
    const input = [
      'api_key = "abcdef123456"',
      'API_KEY=secretvalue',
      'password: hunter2',
      'token="ghp_0123456789"',
      'secret = 12345',
    ].join('\n');
    const out = desensitize(input);
    expect(out).not.toContain('abcdef123456');
    expect(out).not.toContain('secretvalue');
    expect(out).not.toContain('hunter2');
    expect(out).not.toContain('ghp_0123456789');
    expect(out).toContain('api_key=***');
    expect(out).toContain('password=***');
  });

  it('masks Authorization Bearer tokens', () => {
    expect(desensitize('Authorization: Bearer abc.DEF.ghi')).toBe('Authorization: Bearer ***');
  });

  it('leaves ordinary content untouched', () => {
    const text = 'function add(a, b) { return a + b; }';
    expect(desensitize(text)).toBe(text);
  });
});

describe('read_file / search_code masking', () => {
  it('read_file scrubs secrets from returned content', async () => {
    const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'desens-'));
    const file = path.join(ws, 'config.txt');
    fs.writeFileSync(file, 'api_key=sk-1234567890abcdef\npassword = "s3cret"');

    const result = await readFileTool.execute({ path: 'config.txt' }, { workspaceRoot: ws });
    expect(result.success).toBe(true);
    expect(result.content).not.toContain('sk-1234567890abcdef');
    expect(result.content).not.toContain('s3cret');
    expect(result.content).toContain('api_key=***');
  });

  it('search_code scrubs secrets from matched lines', async () => {
    const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'desens-search-'));
    fs.writeFileSync(path.join(ws, 'app.ts'), 'const token = "ghp_secret_token_here";');

    const result = await searchCodeTool.execute({ pattern: 'token' }, { workspaceRoot: ws });
    expect(result.success).toBe(true);
    expect(result.content).not.toContain('ghp_secret_token_here');
    expect(result.content).toContain('token=***');
  });
});
