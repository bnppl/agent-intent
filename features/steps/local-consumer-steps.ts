import { Given, When, Then } from '@cucumber/cucumber';
import { assert, logEvidence, spawnWithEvidence } from '../support/evidence.js';

let pattern: string;
let result: ReturnType<typeof spawnWithEvidence>;

Given('a consuming project links to the sibling Agent Intent checkout', () => {
  pattern = 'builds the sibling checkout';
  logEvidence('Fixture selection', 'An isolated consumer linked to an isolated source checkout.');
});
Given('the sibling Agent Intent build fails', () => {
  pattern = 'returns a build failure';
  logEvidence('Fixture selection', 'An isolated checkout whose build exits with status 7.');
});
Given('the sibling Agent Intent project is serving its report on the intent port', () => {
  pattern = 'stops the sibling report server';
  logEvidence('Fixture selection', 'An isolated report server on an operating-system-assigned test port.');
});

function exercise(): void {
  result = spawnWithEvidence(process.execPath, ['--import', 'tsx', '--test', '--test-name-pattern=' + pattern,
    'tests/local-consumer-workflow.test.ts'], { encoding: 'utf8' });
}
When('I run an Agent Intent command through the local development workflow', exercise);
When('I run the report shutdown command from the consuming project', exercise);

function passed(): void {
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /pass 1/);
  assert.match(result.stdout, /fail 0/);
}
Then('the workflow builds the sibling checkout before running the command from the consuming project', passed);
Then('the workflow reports the build failure without running the linked command', passed);
Then("the sibling project's Agent Intent server stops", passed);
