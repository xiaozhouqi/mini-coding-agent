import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { readProjectInstructions } from '../src/agent/projectInstructions';

function makeWorkspace(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'project-instructions-'));
}

describe('readProjectInstructions', () => {
  it('returns AGENTS.md content when present', () => {
    const ws = makeWorkspace();
    fs.writeFileSync(path.join(ws, 'AGENTS.md'), 'use pnpm');
    expect(readProjectInstructions(ws)).toBe('use pnpm');
  });

  it('falls back to CLAUDE.md when AGENTS.md is absent', () => {
    const ws = makeWorkspace();
    fs.writeFileSync(path.join(ws, 'CLAUDE.md'), 'use yarn');
    expect(readProjectInstructions(ws)).toBe('use yarn');
  });

  it('prefers AGENTS.md over CLAUDE.md when both exist', () => {
    const ws = makeWorkspace();
    fs.writeFileSync(path.join(ws, 'AGENTS.md'), 'AGENTS wins');
    fs.writeFileSync(path.join(ws, 'CLAUDE.md'), 'CLAUDE loses');
    expect(readProjectInstructions(ws)).toBe('AGENTS wins');
  });

  it('returns empty string when neither file exists', () => {
    const ws = makeWorkspace();
    expect(readProjectInstructions(ws)).toBe('');
  });
});
