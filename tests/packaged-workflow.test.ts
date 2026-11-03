import { it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { createServer } from 'node:net';
const cli = resolve('runtime/cli.cjs');
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'intent-consumer-'));
  mkdirSync(join(root, 'features'));
  const config = (checks: string[][]) => writeFileSync(join(root, '.agent-intent.json'), JSON.stringify({ version: 1, feature_roots: ['features'], checks }));
  const report = [process.execPath, '-e', `require('fs').mkdirSync('.agent-intent/lineage',{recursive:true});require('fs').writeFileSync('.agent-intent/lineage/latest.json',JSON.stringify({version:1,scenarios:[],tests:[]}));`];
  return { root, config, report, close: () => rmSync(root, { recursive: true, force: true }) };
}
function invoke(root: string, ...args: string[]) {
  return spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8', timeout: 20000 });
}
it('requires explicit commands and fresh report evidence in the consuming project', { tags: ['startup-consumer-run'] }, () => {
  const d = fixture();
  try {
    d.config([]);
    assert.notEqual(invoke(d.root, 'run').status, 0);
    d.config([[process.execPath, '-e', 'process.exit(7)'], d.report]);
    assert.match(invoke(d.root, 'run').stderr, /Check failed/);
    d.config([d.report]);
    assert.equal(invoke(d.root, 'run').status, 0);
    d.config([[process.execPath, '-e', '']]);
    assert.match(invoke(d.root, 'run').stderr, /fresh lineage report/);
  } finally { d.close(); }
});
it('starts the packaged CLI in the consumer, refreshes it, and stops only its server', { tags: ['startup-consumer-server'] }, async () => {
  const d = fixture();
  const probe = createServer();
  await new Promise<void>(done => probe.listen(0, '127.0.0.1', done));
  const port = (probe.address() as { port: number }).port;
  await new Promise<void>(done => probe.close(() => done()));
  const args = ['--port', String(port)];
  try {
    d.config([d.report]);
    const start = invoke(d.root, 'start', ...args);
    assert.equal(start.status, 0, start.stderr);
    assert.match(start.stdout, /Running in background/);
    assert.equal((await fetch(`http://127.0.0.1:${port}`)).status, 200);
    assert.match(invoke(d.root, 'start', ...args).stdout, /already running/);
    const status = JSON.parse(invoke(d.root, 'status', ...args).stdout);
    assert.ok(status.server.pid > 0);
    const other = fixture();
    try { assert.match(invoke(other.root, 'stop', ...args).stderr, /another process or project/); }
    finally { other.close(); }
    assert.equal((await fetch(`http://127.0.0.1:${port}`)).status, 200);
    assert.equal(invoke(d.root, 'stop', ...args).status, 0);
    assert.equal(readFileSync(join(d.root, '.agent-intent.json'), 'utf8').includes('checks'), true);
  } finally {
    invoke(d.root, 'stop', ...args);
    d.close();
  }
});
