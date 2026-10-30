import { After, Given, Then, When } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { IntentWorld } from '../hooks.js';
import { PresentationDriver } from '../support/presentation-driver.js';

type PresentationWorld = IntentWorld & { presentation?: PresentationDriver; failure?: boolean; pages?: string[] };
function driver(world: PresentationWorld): PresentationDriver { assert.ok(world.presentation); return world.presentation; }
function section(html: string, name: string): string {
  const result = [...html.matchAll(/<section\b[^>]*>[\s\S]*?<\/section>/g)].find(match => match[0].includes(`<h2>${name}</h2>`));
  assert.ok(result, 'Missing specification: ' + name); return result[0];
}
function changeSource(world: PresentationWorld, both = false): void {
  const d = driver(world);
  let source = readFileSync(join(d.root, 'features/example.feature'), 'utf8').replace('the first promise', 'a changed first promise');
  if (both) source = source.replace('the second promise', 'a changed second promise');
  d.write('features/example.feature', source);
}
async function generate(world: PresentationWorld): Promise<void> {
  driver(world).run(['example.test.mjs'], world.failure ? 1 : 0);
  (world.pages ??= []).push(await driver(world).page());
}

Given('a specification with associated unit-test descriptions', function (this: PresentationWorld) {
  this.presentation = new PresentationDriver(); this.presentation.fixtures();
});
When('I view the generated report', async function (this: PresentationWorld) { await generate(this); });
Then('the specification has an icon indicating that it can be expanded', async function (this: PresentationWorld) {
  assert.match(section(await driver(this).page(), 'First specification'), /<summary><svg class="expand-icon"/);
});
Then('its associated unit-test descriptions are inside the expandable section', async function (this: PresentationWorld) {
  assert.match(section(await driver(this).page(), 'First specification'), /<details>[\s\S]*?<li[^>]*>Reporting › supports the first promise[\s\S]*?<\/details>/);
});
Then('the icon distinguishes collapsed and expanded states', async function (this: PresentationWorld) {
  const css = await (await driver(this).request('/lineage.css')).text();
  assert.match(css, /details\[open\] > summary \.expand-icon\s*\{\s*transform: rotate\(90deg\)/);
});

Given('a specification with a passing associated unit test', function (this: PresentationWorld) {
  this.presentation = new PresentationDriver(); this.presentation.fixtures();
});
Given('a specification with a failing associated unit test', function (this: PresentationWorld) {
  this.failure = true;
  driver(this).write('example.test.mjs', `import { it } from 'node:test';
it('passing promise', {tags:['first']}, () => {});
it('failing promise', {tags:['second']}, () => { throw Error('expected fixture failure'); });`);
});
When('the tests run with HTML reporting enabled', async function (this: PresentationWorld) { await generate(this); });
Then('the report is generated despite the test failure', async function (this: PresentationWorld) {
  assert.match(await driver(this).page(), /<!doctype html>/i);
});
Then('the passing result is coloured green and labelled {string}', async function (this: PresentationWorld, label: string) {
  assert.match(section(await driver(this).page(), 'First specification'), /data-result="passed"/);
  assert.ok((await driver(this).page()).includes(`class="badge result-passed">${label}</span>`));
  assert.match(await (await driver(this).request('/lineage.css')).text(), /--passed: #205545/);
});
Then('the failing result is coloured red and labelled {string}', async function (this: PresentationWorld, label: string) {
  assert.match(section(await driver(this).page(), 'Second specification'), /data-result="failed"/);
  assert.ok((await driver(this).page()).includes(`class="badge result-failed">${label}</span>`));
  assert.match(await (await driver(this).request('/lineage.css')).text(), /--failed: #a13930/);
});
Then('a specification with a failing associated unit test is labelled {string}', async function (this: PresentationWorld, label: string) {
  assert.ok(section(await driver(this).page(), 'Second specification').includes(`class="badge result-failed">${label}</span>`));
});

Given('a previously generated report whose specification changes were accepted in the web interface', async function (this: PresentationWorld) {
  this.presentation = new PresentationDriver(); await this.presentation.acceptInitial();
});
Given('a specification has changed since that accepted report', function (this: PresentationWorld) { changeSource(this); });
Given('two specifications have changed since that accepted report', function (this: PresentationWorld) { changeSource(this, true); });
When('a new report is generated', async function (this: PresentationWorld) { await generate(this); });
When('a new report is generated without accepting those changes', async function (this: PresentationWorld) { await generate(this); });
When('another report is generated', async function (this: PresentationWorld) { await generate(this); });
Then('the changed specification has a coloured {string} marker', async function (this: PresentationWorld, label: string) {
  const html = section(await driver(this).page(), 'First specification');
  assert.ok(html.includes(`class="badge change-modified">${label}</span>`));
  assert.match(await (await driver(this).request('/lineage.css')).text(), /\.change-modified\s*\{[^}]*color:/);
});
Then('its test-result colour and label remain visible separately', async function (this: PresentationWorld) {
  assert.match(section(await driver(this).page(), 'First specification'), /class="badge result-passed">Passed<\/span><span class="badge change-modified">Modified<\/span>/);
});
Then('unchanged specifications have no {string} marker', async function (this: PresentationWorld, label: string) {
  assert.doesNotMatch(section(await driver(this).page(), 'Second specification'), new RegExp(`>${label}</span>`));
});
Then('both reports identify the specification as modified since the accepted report', function (this: PresentationWorld) {
  assert.equal(this.pages?.length, 2);
  for (const html of this.pages!) assert.match(section(html, 'First specification'), /data-change="modified"/);
});
When('I accept the first specification change in the web interface', async function (this: PresentationWorld) {
  await generate(this);
  const response = await driver(this).accept('First specification');
  assert.equal(response.status, 200, await response.text());
});
Then('that specification is no longer marked as modified', async function (this: PresentationWorld) {
  assert.match(section(await driver(this).page(), 'First specification'), /data-change="unchanged"/);
});
Then('the second specification remains marked as modified', async function (this: PresentationWorld) {
  assert.match(section(await driver(this).page(), 'Second specification'), /data-change="modified"/);
});
Given('a specification has been added and another has been removed', function (this: PresentationWorld) {
  const d = driver(this);
  d.write('features/example.feature', readFileSync(join(d.root, 'features/example.feature'), 'utf8')
    .replace('Second specification', 'Third specification'));
});
Then('the new specification has a coloured {string} marker', async function (this: PresentationWorld, label: string) {
  assert.ok(section(await driver(this).page(), 'Third specification').includes(`class="badge change-added">${label}</span>`));
});
Then('the removed specification has a coloured {string} marker', async function (this: PresentationWorld, label: string) {
  assert.ok(section(await driver(this).page(), 'Second specification').includes(`class="badge change-removed">${label}</span>`));
});

Given('a report with passing, failing and unexecuted specifications', async function (this: PresentationWorld) {
  this.presentation = new PresentationDriver(); await this.presentation.acceptInitial();
  changeSource(this);
  const d = driver(this);
  d.write('features/example.feature', readFileSync(join(d.root, 'features/example.feature'), 'utf8')
    + '\n  @third\n  Scenario: Third specification\n    Given an untested promise\n');
  d.write('example.test.mjs', `import { it } from 'node:test';
it('passing promise', {tags:['first']}, () => {});
it('failing promise', {tags:['second']}, () => { throw Error('expected fixture failure'); });`);
  this.failure = true;
});
Then('failed specifications are grouped before passed and unexecuted specifications', async function (this: PresentationWorld) {
  const html = await driver(this).page();
  const failed = html.indexOf('data-run-group="failed"'), passed = html.indexOf('data-run-group="passed"'), unrun = html.indexOf('data-run-group="not-run"');
  assert.ok(failed >= 0 && failed < passed && passed < unrun);
  assert.match(html.slice(failed, passed), /<h2>Second specification<\/h2>/);
  assert.match(html.slice(passed, unrun), /<h2>First specification<\/h2>/);
  assert.match(html.slice(unrun), /<h2>Third specification<\/h2>/);
});
Then('each run-status group separates added, changed and unchanged specifications', async function (this: PresentationWorld) {
  const html = await driver(this).page();
  for (const [status, change, name] of [['failed', 'unchanged', 'Second'], ['passed', 'modified', 'First'], ['not-run', 'added', 'Third']]) {
    const start = html.indexOf(`data-run-group="${status}"`);
    const next = html.indexOf('data-run-group=', start + 1);
    const group = html.slice(start, next < 0 ? undefined : next);
    assert.match(group, new RegExp(`data-change-group="${change}"[\\s\\S]*?<h2>${name} specification</h2>`));
  }
});
Then('each group shows its number of specifications', async function (this: PresentationWorld) {
  const html = await driver(this).page();
  assert.equal(html.match(/data-group-count>1 specification<\/span>/g)?.length, 6);
});
After(async function (this: PresentationWorld) { await this.presentation?.stop(); });

Then('the Intent DD report shows the accepted Gherkin alongside its supporting tests', async function (this: PresentationWorld) {
  const response = await driver(this).request('/');
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<h1>Intent DD report<\/h1>/);
  const first = section(html, 'First specification');
  assert.match(first, /class="gherkin-specification"[\s\S]*?Scenario: First specification[\s\S]*?Given the first promise/);
  assert.match(first, /Reporting › supports the first promise/);
  assert.doesNotMatch(first, /class="spec-change"/);
});
Then('each supporting test displays the lineage ID connecting it to the scenario', async function (this: PresentationWorld) {
  const html = section(await driver(this).page(), 'First specification');
  assert.match(html, /<li[^>]*data-lineage="@first"[^>]*>Reporting › supports the first promise[\s\S]*?Lineage: @first/);
  assert.doesNotMatch(html, /Reporting › supports the second promise/);
});
