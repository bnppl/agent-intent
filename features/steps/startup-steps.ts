import { When, Then } from '@cucumber/cucumber';
import { assert, logEvidence, spawnWithEvidence } from '../support/evidence.js';
import { runChecks } from '../../src/workflow.js';
const commands = [['build'], ['test'], ['test:lineage']];
let calls: string[];
let failure: unknown;
When('the startup checks succeed', async () => {
  calls = []; failure = undefined;
  await runChecks(commands, async ([name]) => { calls.push(name); logEvidence('Check completed', name); });
});
Then('startup runs build, test, and test:lineage in order', () => {
  assert.deepEqual(calls, ['build', 'test', 'test:lineage']);
});
When('the startup test check fails', async () => {
  calls = []; failure = undefined;
  try {
    await runChecks(commands, async ([name]) => {
      calls.push(name);
      logEvidence('Check invoked', name);
      if (name === 'test') throw Error('Failed test');
    });
  }
  catch (error) { failure = error; logEvidence('Check failure', String(error)); }
});
Then('startup fails without running lineage generation', () => {
  assert.ok(failure instanceof Error);
  assert.deepEqual(calls, ['build', 'test']);
});

// Exercise the same packaged-process contract used by the supporting Node tests.
let contractOutput: string;
When('a consuming project runs configured checks through the packaged CLI', async () => {
  const result = spawnWithEvidence(process.execPath, ['--import', 'tsx', '--test', '--test-name-pattern=requires explicit commands', 'tests/packaged-workflow.test.ts'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  contractOutput = result.stdout;
});
Then('missing commands, failed checks, and stale reports are rejected', () => {
  assert.match(contractOutput, /pass 1/);
  assert.match(contractOutput, /fail 0/);
});
When('a consuming project starts and refreshes its workbench through the installed CLI link', async () => {
  const result = spawnWithEvidence(process.execPath, ['--import', 'tsx', '--test', '--test-name-pattern=starts the packaged CLI', 'tests/packaged-workflow.test.ts'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  contractOutput = result.stdout;
});
Then('its page stays available after startup exits and another project cannot stop it', () => {
  assert.match(contractOutput, /pass 1/);
  assert.match(contractOutput, /fail 0/);
});
