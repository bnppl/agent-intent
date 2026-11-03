import { it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { runChecks } from '../src/workflow.js';
const commands = [['build'], ['test'], ['test:lineage']];

it('runs build and all checks before server startup', { tags: ['startup-check-order'] }, async () => {
  const calls: string[] = [];
  await runChecks(commands, async ([name]) => { calls.push(name); });
  assert.deepEqual(calls, ['build', 'test', 'test:lineage']);
});
it('propagates check failures and stops subsequent checks', { tags: ['startup-check-failure'] }, async () => {
  for (const failed of ['build', 'test', 'test:lineage']) {
    const calls: string[] = [];
    await assert.rejects(runChecks(commands, async ([name]) => {
      calls.push(name);
      if (name === failed) throw Error('broken');
    }), /broken/);
    assert.equal(calls.at(-1), failed);
  }
});
it('rejects invalid ports before running checks', () => {
  const result = spawnSync(process.execPath, ['runtime/cli.cjs', 'start', '--port', '0'], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Invalid --port/);
  assert.equal(result.stdout, '');
});
