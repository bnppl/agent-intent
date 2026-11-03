import { When, Then } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { runChecks } from '../../src/workflow.js';
const commands = [['build'], ['test'], ['test:lineage']];
let calls: string[];
let failure: unknown;
When('the startup checks succeed', async () => {
  calls = []; failure = undefined;
  await runChecks(commands, async ([name]) => { calls.push(name); });
});
Then('startup runs build, test, and test:lineage in order', () => {
  assert.deepEqual(calls, ['build', 'test', 'test:lineage']);
});
When('the startup test check fails', async () => {
  calls = []; failure = undefined;
  try { await runChecks(commands, async ([name]) => { calls.push(name); if (name === 'test') throw Error('Failed test'); }); }
  catch (error) { failure = error; }
});
Then('startup fails without running lineage generation', () => {
  assert.ok(failure instanceof Error);
  assert.deepEqual(calls, ['build', 'test']);
});

// Exercise the same packaged-process contract used by the supporting Node tests.
let contractOutput: string;
When('a consuming project runs configured checks through the packaged CLI', async () => {
  const { execFileSync } = await import('node:child_process');
  contractOutput = execFileSync(process.execPath, ['--import', 'tsx', '--test', '--test-name-pattern=requires explicit commands', 'tests/packaged-workflow.test.ts'], { encoding: 'utf8' });
});
Then('missing commands, failed checks, and stale reports are rejected', () => {
  assert.match(contractOutput, /pass 1/);
  assert.match(contractOutput, /fail 0/);
});
When('a consuming project starts and refreshes its packaged workbench', async () => {
  const { execFileSync } = await import('node:child_process');
  contractOutput = execFileSync(process.execPath, ['--import', 'tsx', '--test', '--test-name-pattern=starts the packaged CLI', 'tests/packaged-workflow.test.ts'], { encoding: 'utf8' });
});
Then('its page stays available after startup exits and another project cannot stop it', () => {
  assert.match(contractOutput, /pass 1/);
  assert.match(contractOutput, /fail 0/);
});
