import { existsSync, lstatSync } from 'node:fs';
import { dirname, isAbsolute } from 'node:path';

export class IntentError extends Error {}
export function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
export function decode(data: Uint8Array): string {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(data); }
  catch { throw new IntentError('Project paths and Gherkin source must be valid UTF-8'); }
}
export function safePath(value: unknown): string {
  if (typeof value !== 'string' || !value || /[\\\x00-\x1f]/.test(value) || isAbsolute(value)
    || /^[A-Za-z]:/.test(value) || value.split('/').some(p => ['', '.', '..'].includes(p))) {
    throw new IntentError('Expected a safe project-relative path');
  }
  return value;
}
export function hasSymlinkParent(root: string, file: string): boolean {
  let dir = dirname(file);
  while (dir !== root) {
    if (dir === dirname(dir)) throw new IntentError('Path escapes project');
    if (existsSync(dir) && lstatSync(dir).isSymbolicLink()) return true;
    dir = dirname(dir);
  }
  return false;
}
