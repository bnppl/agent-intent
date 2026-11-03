import { After, Given, Then, When } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { IntentWorld } from '../hooks.js';
import { PresentationDriver } from '../support/presentation-driver.js';

type LockWorld = IntentWorld & { project?: PresentationDriver };
function driver(world: LockWorld): PresentationDriver { assert.ok(world.project); return world.project; }
function verify(world: LockWorld) {
  return spawnSync(process.execPath, [fileURLToPath(new URL('../../runtime/cli.cjs', import.meta.url)), 'verify'],
    { cwd: driver(world).root, encoding: 'utf8' });
}
Given('a project with specifications and related passing tests', function (this: LockWorld) {
  this.project = new PresentationDriver(); this.project.fixtures();
});
When('its tests generate a report', function (this: LockWorld) { driver(this).run(); });
Then('the project home page shows the specification report', async function (this: LockWorld) {
  const response = await driver(this).request('/');
  assert.equal(response.status, 200);
  assert.match(await response.text(), /<h2>First specification<\/h2>/);
});
When('I accept one specification', async function (this: LockWorld) {
  assert.equal((await driver(this).accept('First specification')).status, 200);
});
Then('the lock contains only that accepted specification', function (this: LockWorld) {
  const lock = JSON.parse(readFileSync(join(driver(this).root, 'agent-intent.lock.json'), 'utf8'));
  assert.deepEqual(lock.scenarios.map((s: {name: string}) => s.name), ['First specification']);
});
Then('another test run leaves the lock unchanged', function (this: LockWorld) {
  const path = join(driver(this).root, 'agent-intent.lock.json'), before = readFileSync(path, 'utf8');
  driver(this).run(); assert.equal(readFileSync(path, 'utf8'), before);
});
Then('verification reports pending specification acceptance', function (this: LockWorld) {
  const result = verify(this); assert.equal(result.status, 1); assert.match(result.stderr, /acceptance/i);
});
When('I accept every specification', async function (this: LockWorld) {
  for (const name of ['First specification', 'Second specification']) assert.equal((await driver(this).accept(name)).status, 200);
});
Then('verification succeeds against the lock', function (this: LockWorld) {
  const result = verify(this); assert.equal(result.status, 0, result.stderr);
});
After(async function (this: LockWorld) { await this.project?.stop(); });
