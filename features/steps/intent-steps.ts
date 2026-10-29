/** Domain vocabulary. The .feature specification is retained without edits. */
import { Given, When, Then } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { renameSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { RepositoryDriver, FEATURE, GLUE, SUPPORT } from '../support/repository-driver.js';
import type { IntentWorld } from '../hooks.js';
function driver(world: IntentWorld): RepositoryDriver { assert.ok(world.driver, 'Repository fixture is missing'); return world.driver; }
Given('a repository with an unmarked Gherkin scenario', function (this: IntentWorld) { this.driver = new RepositoryDriver(false); });
Given('a repository with an accepted intent scenario', function (this: IntentWorld) { this.driver = new RepositoryDriver(); });
Given('a repository with a staged intent change', function (this: IntentWorld) {
  this.driver = new RepositoryDriver(); this.driver.write(GLUE, this.driver.read(GLUE) + '\n// changed glue\n'); this.driver.stage();
});
When('the developer marks the scenario as intent through the local API', async function (this: IntentWorld) {
  const result = await driver(this).annotate(true); assert.equal(result.status, 200, result.body);
});
Then('the feature file contains the intent annotation', function (this: IntentWorld) { assert.ok(driver(this).read(FEATURE).includes('@intent')); });
Then('no commit is created by the annotation', function (this: IntentWorld) {
  const d = driver(this); assert.equal(d.repo.head, d.annotationHead); assert.equal(d.git(['diff', '--cached', '--name-only']), '');
});
When('the specification is changed and staged', function (this: IntentWorld) {
  const d = driver(this); d.write(FEATURE, d.read(FEATURE).replace('booking is preserved', 'booking is replaced')); d.stage();
});
When('its glue code is changed and staged', function (this: IntentWorld) {
  const d = driver(this); d.write(GLUE, d.read(GLUE).replace('if (!this.booking) throw Error("Missing booking");', 'return;')); d.stage();
});
When('its support code is changed and staged', function (this: IntentWorld) { const d = driver(this); d.write(SUPPORT, 'export function assertPreserved(value: boolean) {}\n'); d.stage(); });
When('the intent tag is removed and staged', function (this: IntentWorld) { const d = driver(this); d.write(FEATURE, d.read(FEATURE).replace('  @intent\n', '')); d.stage(); });
When('the feature file is deleted and staged', function (this: IntentWorld) { const d = driver(this); unlinkSync(join(d.root, FEATURE)); d.stage(); });
When('another glue file is added and staged', function (this: IntentWorld) {
  const d = driver(this); d.write('features/steps/override.ts', 'import { Then } from "@cucumber/cucumber";\nThen("the booking is preserved", function () {});\n'); d.stage();
});
When('only the system under test is changed and staged', function (this: IntentWorld) { const d = driver(this); d.write('application.ts', 'export function book() { return { booked: true }; }\n'); d.stage(); });
When('its glue code is changed but not staged', function (this: IntentWorld) { const d = driver(this); d.write(GLUE, d.read(GLUE) + '\n// unstaged\n'); });
When('a human approves the displayed staged revision', async function (this: IntentWorld) { const result = await driver(this).approval(); assert.equal(result.status, 200, result.body); });
When('another change is staged', function (this: IntentWorld) { const d = driver(this); d.write('application.ts', '// another staged change\n'); d.stage(); });
When('the staged revision changes after the review is opened', async function (this: IntentWorld) {
  const d = driver(this); this.oldRevision = (await d.workspace()).review.revision; d.write('application.ts', '// new revision\n'); d.stage();
});
Then('approval of the old review is refused', async function (this: IntentWorld) {
  assert.ok(this.oldRevision); const result = await driver(this).approval(this.oldRevision); assert.equal(result.status, 409, result.body); assert.match(result.body, /changed after review/);
});
When('the glue protection configuration is weakened and staged', function (this: IntentWorld) {
  const d = driver(this), cfg = JSON.parse(d.read('.intentdd.json')); cfg.glue_roots = ['features/support']; d.write('.intentdd.json', JSON.stringify(cfg)); d.stage();
});
When('invalid Gherkin is staged', function (this: IntentWorld) {
  const d = driver(this); d.write(FEATURE, 'Feature: Broken\n  Scenario: Bad\n    Given a state\n    """\nunterminated\n'); d.stage();
});
When('the index contains an unresolved merge', function (this: IntentWorld) {
  const d = driver(this), oid = d.git(['rev-parse', 'HEAD:' + GLUE]);
  d.git(['update-index', '--index-info'], `0 ${'0'.repeat(40)}\t${GLUE}\n100644 ${oid} 1\t${GLUE}\n100644 ${oid} 2\t${GLUE}\n`);
});
Then('verification requires human approval', function (this: IntentWorld) { const result = driver(this).verify(); assert.equal(result.status, 1, String(result.stdout) + result.stderr); assert.match(String(result.stderr), /Human approval required/); });
Then('verification allows the commit', function (this: IntentWorld) { const result = driver(this).verify(); assert.equal(result.status, 0, String(result.stdout) + result.stderr); });
Then('verification fails with a parse error', function (this: IntentWorld) { const result = driver(this).verify(); assert.equal(result.status, 1); assert.match(String(result.stderr), /Gherkin parse error/); });
Then('verification refuses the index', function (this: IntentWorld) { const result = driver(this).verify(); assert.equal(result.status, 1); assert.match(String(result.stderr), /unmerged|merge conflict/i); });
Given('the trusted pre-commit hook is installed', function (this: IntentWorld) { driver(this).installTrusted(); });
When('the candidate verifier is changed to always pass', function (this: IntentWorld) { const d = driver(this); d.write('runtime/cli.cjs', 'process.exit(0);\n'); d.stage(); });
Then('a real Git commit is refused', function (this: IntentWorld) { const result = driver(this).commit(); assert.notEqual(result.status, 0, String(result.stdout)); assert.match(String(result.stderr), /Human approval required/); });
