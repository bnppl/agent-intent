import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { it } from 'node:test';
import type { TestContext } from 'node:test';

function fixture(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), 'intent-local-consumer-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const consumer = join(root, 'consumer');
  const sibling = join(root, 'agent-intent');
  mkdirSync(join(consumer, 'node_modules', '.bin'), { recursive: true });
  mkdirSync(join(sibling, 'scripts'), { recursive: true });
  cpSync('src', join(sibling, 'src'), { recursive: true });
  cpSync('runtime', join(sibling, 'runtime'), { recursive: true });
  cpSync('scripts/build.mjs', join(sibling, 'scripts', 'build.mjs'));
  cpSync('package.json', join(sibling, 'package.json'));
  symlinkSync(resolve('node_modules'), join(sibling, 'node_modules'));
  symlinkSync(join(sibling, 'runtime', 'cli.cjs'), join(consumer, 'node_modules', '.bin', 'agent-intent'));
  writeFileSync(join(consumer, 'package.json'), JSON.stringify({ scripts: {
    intent: 'agent-intent',
    'intent:build': 'npm --prefix ../agent-intent run build',
    'intent:dev': 'npm run intent:build && npm run intent --',
    'intent:kill': 'npm run intent -- stop --root ../agent-intent --port 8765',
  } }));
  mkdirSync(join(consumer, 'features'));
  writeFileSync(join(consumer, 'features', 'example.feature'), 'Feature: Consumer example\n  Scenario: Review a proposal\n    Given a proposal\n');
  return { consumer, sibling };
}

function run(cwd: string, script: string, ...args: string[]) {
  const result = spawnSync('npm', ['run', script, '--', ...args], { cwd, encoding: 'utf8', timeout: 30_000 });
  assert.ifError(result.error);
  return result;
}

it('builds the sibling checkout before invoking the local consumer CLI', { tags: ['try-local-agent-intent'] }, (t) => {
  const { consumer } = fixture(t);
  const { status, stdout, stderr } = run(consumer, 'intent:dev', 'spec');
  assert.equal(status, 0, stderr);
  assert.match(stdout, /Built runtime\/lineage-reporter\.cjs[\s\S]*# Project specifications/);
  assert.match(stdout, /Feature: Consumer example/);
});

it('returns a build failure without invoking the linked command', { tags: ['stop-on-agent-intent-build-failure'] }, (t) => {
  const { consumer, sibling } = fixture(t);
  const pkg = JSON.parse(readFileSync(join(sibling, 'package.json'), 'utf8'));
  pkg.scripts.build = 'echo BUILD_FAILED && exit 7';
  writeFileSync(join(sibling, 'package.json'), JSON.stringify(pkg));
  const { status, stdout, stderr } = run(consumer, 'intent:dev', 'init');
  assert.equal(status, 7, stdout + stderr);
  assert.match(stdout, /BUILD_FAILED/);
  assert.throws(() => readFileSync(join(consumer, 'intent.md')), { code: 'ENOENT' });
});

it('stops the sibling report server through the consumer shutdown command', { tags: ['stop-agent-intent-report'] }, async (t) => {
  const { consumer, sibling } = fixture(t);
  const cli = join(sibling, 'runtime', 'cli.cjs');
  const server = spawn(process.execPath, [cli, 'serve', '--port', '0'], { cwd: sibling, stdio: ['ignore', 'pipe', 'inherit'] });
  const closed = once(server, 'close');
  t.after(async () => { server.kill(); await closed; });
  const [output] = await once(server.stdout!, 'data', { signal: AbortSignal.timeout(5000) });
  const port = String(output).match(/http:\/\/127\.0\.0\.1:(\d+)/)?.[1];
  assert.ok(port, String(output));
  const result = run(consumer, 'intent:kill', '--port', port);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes(`Stopped Agent Intent PID ${server.pid} on port ${port}.`), result.stdout);
  const [, signal] = await closed;
  assert.equal(signal, 'SIGTERM');
});
