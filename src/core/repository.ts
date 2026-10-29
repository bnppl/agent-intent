import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, readlinkSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import type { Revision } from './types.js';

export class IntentError extends Error {}
export type Snapshot = Map<string, Blob>;
export function decode(data: Uint8Array): string {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(data); }
  catch { throw new IntentError('Repository paths and Gherkin source must be valid UTF-8'); }
}
export function safePath(value: unknown): string {
  if (typeof value !== 'string' || !value || /[\\\x00-\x1f]/.test(value) || isAbsolute(value)
    || /^[A-Za-z]:/.test(value) || value.split('/').some(p => ['', '.', '..', '.git'].includes(p))) {
    throw new IntentError('Expected a safe repository-relative path');
  }
  return value;
}
export function under(path: string, roots: string[]): boolean {
  return roots.some(root => path === root || path.startsWith(root + '/'));
}
export class Blob {
  constructor(readonly mode: string, readonly data: Buffer) {}
  get digest(): string { return createHash('sha256').update(this.mode + '\0').update(this.data).digest('hex'); }
  equals(other: Blob | undefined): boolean { return !!other && this.mode === other.mode && this.data.equals(other.data); }
}
export function hasSymlinkParent(root: string, file: string): boolean {
  let dir = dirname(file);
  while (dir !== root) {
    if (dir === dirname(dir)) throw new IntentError('Path escapes repository');
    if (existsSync(dir) && lstatSync(dir).isSymbolicLink()) return true;
    dir = dirname(dir);
  }
  return false;
}
export class Repository {
  readonly root: string;
  constructor(root: string) {
    this.root = resolve(root);
    this.root = decode(this.git(['rev-parse', '--show-toplevel'])).trimEnd();
  }
  git(args: string[], ok = false, input?: string): Buffer {
    const result = spawnSync('git', ['-C', this.root, ...args], { input, maxBuffer: 64 * 1024 * 1024 });
    if (result.error || (result.status !== 0 && !ok)) {
      throw new IntentError(result.error?.message || decode(result.stderr).trim() || 'Git operation failed');
    }
    return result.stdout;
  }
  get head(): string { return decode(this.git(['rev-parse', '--verify', 'HEAD'], true)).trim() || 'UNBORN'; }
  get stateDir(): string { return resolve(this.root, decode(this.git(['rev-parse', '--git-path', 'intent-dd'])).trimEnd()); }
  revision(): Revision { return { head: this.head, tree: decode(this.git(['write-tree'])).trim() }; }
  diff(): string { return this.git(['diff', '--cached', '--no-ext-diff', '--no-textconv', '--no-color', '--no-renames']).toString('utf8'); }
  snapshot(ref: 'HEAD' | 'INDEX' | 'WORKTREE'): Snapshot {
    const result: Snapshot = new Map();
    if (ref === 'HEAD' && this.head === 'UNBORN') return result;
    if (ref === 'HEAD' || ref === 'INDEX') {
      const entries = decode(this.git(ref === 'HEAD' ? ['ls-tree', '-r', '-z', 'HEAD'] : ['ls-files', '--stage', '-z'])).split('\0').filter(Boolean);
      for (const entry of entries) {
        const tab = entry.indexOf('\t');
        const meta = entry.slice(0, tab).split(' '), path = safePath(entry.slice(tab + 1));
        const [mode, middle, last] = meta;
        if (ref === 'INDEX' && last !== '0') throw new IntentError('Resolve all merge conflicts before reviewing intent');
        const oid = ref === 'HEAD' ? last : middle;
        const data = mode === '160000' ? Buffer.from(oid) : this.git(['cat-file', 'blob', oid]);
        result.set(path, new Blob(mode, data));
      }
    } else {
      const paths = new Set(decode(this.git(['ls-files', '--cached', '--others', '--exclude-standard', '-z'])).split('\0').filter(Boolean));
      for (const raw of paths) {
        const path = safePath(raw), full = join(this.root, path);
        if (hasSymlinkParent(this.root, full)) throw new IntentError('Symlinked parent directory: ' + path);
        let stat;
        try { stat = lstatSync(full); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue; throw error; }
        if (stat.isSymbolicLink()) result.set(path, new Blob('120000', Buffer.from(readlinkSync(full))));
        else if (stat.isFile()) result.set(path, new Blob(stat.mode & 0o111 ? '100755' : '100644', readFileSync(full)));
      }
    }
    return result;
  }
}
