import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { SecurityError, isSensitivePath, resolveSafePath } from '../src/tools/ToolSandbox';

function makeWorkspace(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'agent-sandbox-'));
}

// Symlinks need Developer Mode / admin on Windows; probe once and skip the
// symlink case if the OS won't allow creating one.
const canSymlink = (() => {
  const ws = makeWorkspace();
  const target = path.join(os.tmpdir(), 'agent-symlink-probe.txt');
  try {
    fs.writeFileSync(target, 'x');
    fs.symlinkSync(target, path.join(ws, 'probe'));
    return true;
  } catch {
    return false;
  }
})();

describe('resolveSafePath', () => {
  it('allows a file inside the workspace', () => {
    const ws = makeWorkspace();
    const file = path.join(ws, 'a.txt');
    fs.writeFileSync(file, 'hello');
    expect(resolveSafePath(ws, 'a.txt')).toBe(fs.realpathSync(file));
  });

  it('rejects ../ traversal outside the workspace', () => {
    const ws = makeWorkspace();
    const outside = path.join(os.tmpdir(), 'agent-outside.txt');
    fs.writeFileSync(outside, 'secret');
    expect(() => resolveSafePath(ws, '../agent-outside.txt')).toThrow(SecurityError);
  });

  it.skipIf(!canSymlink)('rejects a symlink pointing outside the workspace', () => {
    const ws = makeWorkspace();
    const outside = path.join(os.tmpdir(), 'agent-symlink-target.txt');
    fs.writeFileSync(outside, 'secret');
    const link = path.join(ws, 'link.txt');
    fs.symlinkSync(outside, link);
    expect(() => resolveSafePath(ws, 'link.txt')).toThrow(SecurityError);
  });

  it('rejects a path that does not exist', () => {
    const ws = makeWorkspace();
    expect(() => resolveSafePath(ws, 'nope.txt')).toThrow(SecurityError);
  });
});

describe('isSensitivePath', () => {
  it('flags secret and key material', () => {
    expect(isSensitivePath(path.join('ws', '.env'))).toBe(true);
    expect(isSensitivePath(path.join('ws', '.env.production'))).toBe(true);
    expect(isSensitivePath(path.join('ws', 'server.pem'))).toBe(true);
    expect(isSensitivePath(path.join('ws', 'id_rsa'))).toBe(true);
    expect(isSensitivePath(path.join('ws', '.credentials'))).toBe(true);
  });

  it('allows normal files', () => {
    expect(isSensitivePath(path.join('ws', 'src', 'index.ts'))).toBe(false);
  });
});
