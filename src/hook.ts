import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { IntentError, Repository, decode } from './core/repository.js';

const MARKER = '# Intent DD trusted HEAD loader v2';
const TRUSTED_LOADER = String.raw`'use strict';
const {spawnSync} = require('node:child_process');
const {mkdtempSync, writeFileSync, rmSync} = require('node:fs');
const {join} = require('node:path');
const {tmpdir} = require('node:os');
const env = {...process.env}; delete env.NODE_OPTIONS; delete env.NODE_PATH;
function git(args) {
  const r = spawnSync('git', args, {env, maxBuffer: 64 * 1024 * 1024});
  if (r.error || r.status !== 0) throw Error(r.error?.message || r.stderr.toString().trim() || 'Git failed');
  return r.stdout;
}
let directory;
try {
  const root = git(['rev-parse', '--show-toplevel']).toString().trimEnd();
  const entry = git(['ls-tree', 'HEAD', '--', 'runtime/cli.cjs']).toString();
  if (!/^(100644|100755) blob [0-9a-f]+\truntime\/cli\.cjs\n$/.test(entry)) throw Error('Committed runtime/cli.cjs is missing or unsafe. Review and commit the installation first.');
  const source = git(['show', 'HEAD:runtime/cli.cjs']);
  directory = mkdtempSync(join(tmpdir(), 'intent-dd-trusted-'));
  const file = join(directory, 'cli.cjs'); writeFileSync(file, source, {mode: 0o600});
  const result = spawnSync(process.execPath, [file, '--repo', root, 'verify'], {env, stdio:'inherit'});
  if (result.error) throw result.error;
  process.exitCode = result.status === 0 ? 0 : 1;
} catch (error) { console.error('Intent DD hook failed closed: ' + error.message); process.exitCode=1; }
finally { if (directory) rmSync(directory, {recursive:true,force:true}); }
`;
function quote(value: string): string { return "'" + value.replaceAll("'", "'\\''") + "'"; }
export function installHook(repo: Repository): string {
  if (decode(repo.git(['config', '--get', 'core.hooksPath'], true)).trim()) throw new IntentError('core.hooksPath is already configured. Integrate with that hook manager explicitly; existing configuration was preserved.');
  if (repo.head === 'UNBORN') throw new IntentError('Commit the Intent DD installation first. The hook must load a trusted committed runtime.');
  const entry = decode(repo.git(['ls-tree', 'HEAD', '--', 'runtime/cli.cjs']));
  if (!/^(100644|100755) blob [0-9a-f]+\truntime\/cli\.cjs\n$/.test(entry)) throw new IntentError('Commit the Intent DD installation first. The hook requires runtime/cli.cjs in trusted HEAD.');
  const hook = resolve(repo.root, decode(repo.git(['rev-parse', '--git-path', 'hooks/pre-commit'])).trimEnd());
  if (existsSync(hook) && !/# Intent DD trusted HEAD loader v[12]/.test(readFileSync(hook, 'utf8'))) throw new IntentError('An existing pre-commit hook was preserved. Chain the Intent DD trusted loader explicitly.');
  const loader = join(repo.stateDir, 'pre-commit.cjs');
  mkdirSync(dirname(loader), { recursive: true }); mkdirSync(dirname(hook), { recursive: true });
  writeFileSync(loader, TRUSTED_LOADER, { mode: 0o600 });
  writeFileSync(hook, '#!/bin/sh\n' + MARKER + '\nunset NODE_OPTIONS NODE_PATH\nexec ' + quote(process.execPath)
    + ' "$(git rev-parse --git-path intent-dd/pre-commit.cjs)"\n');
  chmodSync(hook, 0o755);
  return hook;
}
