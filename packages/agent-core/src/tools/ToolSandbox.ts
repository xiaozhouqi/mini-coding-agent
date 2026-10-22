import * as fs from 'node:fs';
import * as path from 'node:path';

// TEACHING: Security boundary. Every file tool must run its path through here
// before touching the filesystem.

export class SecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecurityError';
  }
}

// TEACHING: Sensitive-file blacklist — reading these is always blocked, even
// inside the workspace.
const SENSITIVE_PATTERNS: RegExp[] = [
  /^\.env$/,
  /^\.env\./,
  /\.pem$/,
  /\.key$/,
  /\.crt$/,
  /\.p12$/,
  /^id_rsa$/,
  /^id_rsa\./,
  /^\.credentials$/,
];

export function isSensitivePath(p: string): boolean {
  const base = path.basename(p);
  return SENSITIVE_PATTERNS.some((re) => re.test(base));
}

// TEACHING: Path sandbox — resolve symlinks to the real physical path, then
// require the result to live inside the workspace root.
export function resolveSafePath(workspaceRoot: string, inputPath: string): string {
  const root = fs.realpathSync(path.resolve(workspaceRoot));
  const absolutePath = path.resolve(root, inputPath);

  let realPath: string;
  try {
    realPath = fs.realpathSync(absolutePath);
  } catch {
    throw new SecurityError(`Path does not exist: ${inputPath}`);
  }

  // Compare against root + separator so a sibling like "/ws-other" can't pass
  // a naive startsWith("/ws") check.
  if (realPath !== root && !realPath.startsWith(root + path.sep)) {
    throw new SecurityError(`Access denied: path outside workspace (${inputPath})`);
  }

  return realPath;
}

// TEACHING: Write-path variant — the target file may not exist yet, so resolve
// the nearest existing ancestor's realpath and re-append the non-existent tail.
// This still catches ".." traversal and symlink escapes.
export function resolveSafeWritePath(workspaceRoot: string, inputPath: string): string {
  const root = fs.realpathSync(path.resolve(workspaceRoot));
  const absolutePath = path.resolve(root, inputPath);

  let ancestor = absolutePath;
  const tail: string[] = [];
  while (!fs.existsSync(ancestor)) {
    const parent = path.dirname(ancestor);
    if (parent === ancestor) break; // reached filesystem root
    tail.unshift(path.basename(ancestor));
    ancestor = parent;
  }

  const realAncestor = fs.realpathSync(ancestor);
  if (realAncestor !== root && !realAncestor.startsWith(root + path.sep)) {
    throw new SecurityError(`Access denied: path outside workspace (${inputPath})`);
  }

  return path.join(realAncestor, ...tail);
}
