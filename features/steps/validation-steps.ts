import { Given, When, Then } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, symlinkSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { workingScenarios } from '../../src/lineage/load.js';
import { definitionText } from '../../src/lineage/definition.js';
import type { ReportModel } from '../../src/lineage/state.js';
import { PresentationDriver } from '../support/presentation-driver.js';

type ValidationWorld = {
  project?: PresentationDriver; discoveryError?: unknown; definition?: ReturnType<typeof workingScenarios>[number];
  result?: ReturnType<typeof spawnSync>; rejected?: Response | number; beforeLock?: string | null;
};
function driver(w: ValidationWorld): PresentationDriver { assert.ok(w.project); return w.project; }
function lockBytes(w: ValidationWorld): string | null {
  const path = join(driver(w).root, 'intentdd.lock.json');
  return existsSync(path) ? readFileSync(path, 'utf8') : null;
}
function cli(w: ValidationWorld, command: string) {
  return spawnSync(process.execPath, [fileURLToPath(new URL('../../runtime/cli.cjs', import.meta.url)), command],
    {cwd: driver(w).root, encoding:'utf8'});
}
function source(w: ValidationWorld): string { return readFileSync(join(driver(w).root, 'features/example.feature'), 'utf8'); }

When('specification discovery encounters {string}', function(this: ValidationWorld, input: string) {
  const d = driver(this);
  if (input === 'a root outside project') d.write('.intentdd.json', JSON.stringify({version:1, feature_roots:['../outside']}));
  else if (input === 'a symlinked feature') {
    d.write('other.feature', source(this)); unlinkSync(join(d.root, 'features/example.feature'));
    symlinkSync('../other.feature', join(d.root, 'features/example.feature'));
  } else if (input === 'symlinked configuration') {
    d.write('config.json', JSON.stringify({version:1, feature_roots:['features']}));
    symlinkSync('config.json', join(d.root, '.intentdd.json'));
  } else if (input === 'malformed Gherkin') d.write('features/example.feature', 'Scenario: Missing feature\n');
  else assert.fail('Unknown input: ' + input);
  try { workingScenarios(d.root); } catch(error) { this.discoveryError = error; }
});
Then('specification discovery fails with an explanation', function(this: ValidationWorld) {
  assert.ok(this.discoveryError instanceof Error);
  assert.match(this.discoveryError.message, /safe project-relative path|symlinks|regular file|Gherkin/);
});
const semanticSource = `@feature-tag
Feature: Meaning
  Background:
    Given shared setup
  Rule: Inheritance
    @rule-tag
    Scenario Outline: Keep <value>
      Given a value
        """
        meaningful text
        """
      Examples: Inputs
        These inputs are authoritative.
        | value |
        | one   |
`;
Given('a specification with inherited tags, a background, a docstring and examples', function(this: ValidationWorld) {
  this.project = new PresentationDriver(); driver(this).write('features/example.feature', semanticSource);
});
When('its specification definition is read', function(this: ValidationWorld) { this.definition = workingScenarios(driver(this).root)[0]; });
Then('inherited tags, docstrings and example values are preserved', function(this: ValidationWorld) {
  assert.deepEqual(this.definition!.tags, ['@feature-tag', '@rule-tag']);
  assert.match(this.definition!.definition, /meaningful text/); assert.match(this.definition!.definition, /one/);
});
Then('moving its source lines leaves its fingerprint unchanged', function(this: ValidationWorld) {
  driver(this).write('features/example.feature', '\n\n' + semanticSource);
  assert.equal(workingScenarios(driver(this).root)[0].fingerprint, this.definition!.fingerprint);
});
Then('changing its background or example value changes its fingerprint', function(this: ValidationWorld) {
  for (const changed of [semanticSource.replace('shared setup', 'different setup'), semanticSource.replace('one   ', 'two   ')]) {
    driver(this).write('features/example.feature', changed);
    assert.notEqual(workingScenarios(driver(this).root)[0].fingerprint, this.definition!.fingerprint);
  }
});
Then('example descriptions remain visible in its readable definition', function(this: ValidationWorld) {
  assert.match(definitionText(this.definition!.definition), /These inputs are authoritative\./);
});
When('I request the current specification source', function(this: ValidationWorld) { this.result = cli(this, 'spec'); });
Then('both current Gherkin scenarios are printed without creating a report', function(this: ValidationWorld) {
  assert.equal(this.result!.status, 0, String(this.result!.stderr));
  assert.match(String(this.result!.stdout), /Scenario: First specification/);
  assert.match(String(this.result!.stdout), /Scenario: Second specification/);
  assert.equal(existsSync(join(driver(this).root, '.intentdd/lineage/latest.json')), false);
});
When('its specification source changes without another run', function(this: ValidationWorld) {
  driver(this).write('features/example.feature', source(this).replace('the first promise', 'a changed promise'));
});
Then('verification asks for a new test run', function(this: ValidationWorld) {
  const result = cli(this, 'verify'); assert.equal(result.status, 1); assert.match(result.stderr, /rerun tests/i);
});
When('a new test run has {string}', function(this: ValidationWorld, failure: string) {
  assert.ok(['a failing test','failed teardown'].includes(failure));
  driver(this).write('example.test.mjs', `import {after, describe, it} from 'node:test';
  describe('Run', () => {
    ${failure === 'failed teardown' ? "after(() => { throw Error('teardown failure'); });" : ''}
    it('first', {tags:['first']}, () => { ${failure === 'a failing test' ? "throw Error('test failure');" : ''} });
    it('second', {tags:['second']}, () => {});
  });`);
  driver(this).run(['example.test.mjs'], 1);
});
Then('verification reports a failed test run', function(this: ValidationWorld) {
  const result = cli(this, 'verify'); assert.equal(result.status, 1); assert.match(result.stderr, /failed/i);
});
When('a local acceptance baseline contains the first specification', async function(this: ValidationWorld) {
  const model = await driver(this).model();
  driver(this).write('.intentdd/lineage/accepted.json', JSON.stringify({version:1, scenarios:[model.snapshot.scenarios[0]]}));
});
Then('the accepted specification is readable without creating a portable lock', async function(this: ValidationWorld) {
  assert.deepEqual((await driver(this).model()).accepted.map(s => s.name), ['First specification']);
  assert.equal(lockBytes(this), null);
});
When('I accept the second specification', async function(this: ValidationWorld) { assert.equal((await driver(this).accept('Second specification')).status, 200); });
Then('the portable lock contains both specifications and is the authoritative acceptance baseline', async function(this: ValidationWorld) {
  assert.deepEqual(JSON.parse(lockBytes(this)!).scenarios.map((s: {name:string}) => s.name), ['First specification','Second specification']);
  driver(this).write('.intentdd/lineage/accepted.json', JSON.stringify({version:1,scenarios:[]}));
  assert.equal((await driver(this).model()).accepted.length, 2);
});
When('the portable lock is invalid', function(this: ValidationWorld) { driver(this).write('intentdd.lock.json', 'null'); });
Then('reading acceptance rejects the invalid lock without replacing it', async function(this: ValidationWorld) {
  const response = await driver(this).request('/api/lineage');
  assert.equal(response.status, 409); assert.match(await response.text(), /Invalid lineage acceptance state/);
  assert.equal(lockBytes(this), 'null');
});
When('the second specification is removed and tests generate a report', function(this: ValidationWorld) {
  driver(this).write('features/example.feature', source(this).split('  @second')[0]); driver(this).run();
});
When('I accept the removed specification', async function(this: ValidationWorld) { assert.equal((await driver(this).accept('Second specification')).status, 200); });
Then('the lock retains only the unchanged first specification', async function(this: ValidationWorld) {
  const model = await driver(this).model(); assert.deepEqual(model.accepted, model.snapshot.scenarios);
  assert.deepEqual(model.accepted.map(s => s.name), ['First specification']);
});
function acceptance(model: ReportModel) { return {revision:model.revision, key:model.snapshot.scenarios[0].key, expectedAcceptance:null}; }
When('a local acceptance request has {string}', async function(this: ValidationWorld, problem: string) {
  const d = driver(this), body = acceptance(await d.model());
  if (problem === 'a replaced report') { d.write('example.test.mjs', readFileSync(join(d.root,'example.test.mjs'),'utf8').replace('supports the first promise','checks the first promise')); d.run(); }
  else if (problem === 'changed source') d.write('features/example.feature', source(this).replace('the first promise','a new promise'));
  else if (problem === 'changed acceptance') assert.equal((await d.accept('First specification')).status, 200);
  else assert.equal(problem, 'no session token');
  this.beforeLock = lockBytes(this);
  this.rejected = await d.request('/api/lineage/accept', body, problem === 'no session token' ? '' : undefined);
});
Then('that acceptance request is rejected without changing the lock', function(this: ValidationWorld) {
  assert.ok(this.rejected instanceof Response); assert.ok([403,409].includes(this.rejected.status));
  assert.equal(lockBytes(this), this.beforeLock);
});
When('a local HTTP request has {string}', async function(this: ValidationWorld, problem: string) {
  const d = driver(this);
  if (problem === 'an unexpected host') this.rejected = await d.rawStatus('/api/lineage', {Host:'evil.example'});
  else if (problem === 'cross-site metadata') this.rejected = await d.request('/api/lineage', undefined, undefined, {'Sec-Fetch-Site':'cross-site'});
  else if (problem === 'a foreign origin') this.rejected = await d.request('/api/lineage/accept', {}, undefined, {Origin:'https://example.invalid'});
  else if (problem === 'malformed acceptance') this.rejected = await d.request('/api/lineage/accept', {revision:'bad', key:1});
  else if (problem === 'a non-JSON body') this.rejected = await d.request('/api/lineage/accept', {}, undefined, {'Content-Type':'text/plain'});
  else assert.fail('Unknown HTTP problem: ' + problem);
});
Then('the HTTP request is rejected without creating a lock', function(this: ValidationWorld) {
  const status = typeof this.rejected === 'number' ? this.rejected : this.rejected!.status;
  assert.ok([409,415].includes(status)); assert.equal(lockBytes(this), null);
});
Then('report responses restrict scripts to this server and disable caching', async function(this: ValidationWorld) {
  const response = await driver(this).request('/');
  assert.match(response.headers.get('content-security-policy') ?? '', /script-src 'self'/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});
