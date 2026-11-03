import { After, Given, Then, When } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { readFileSync, realpathSync } from 'node:fs';
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
Then('the report includes the embedded Agent Intent logo', async function (this: PresentationWorld) {
  assert.match(await driver(this).page(), /<img class="brand-logo" src="data:image\/png;base64,[A-Za-z0-9+/=]+" alt="Agent Intent:[^"]+"/);
});
Then('the local image policy permits the embedded logo without permitting external images', async function (this: PresentationWorld) {
  const response = await driver(this).request('/');
  const policy = response.headers.get('content-security-policy') ?? '';
  const sources = policy.split(';').map(part => part.trim()).find(part => part.startsWith('img-src '))?.split(/\s+/).slice(1);
  assert.deepEqual(sources, ["'self'", 'data:']);
  assert.match(policy, /script-src 'self';/);
});
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

Then('the report links to specifications, pending changes and workflow guidance', async function(this: PresentationWorld) {
  const html = await driver(this).page();
  assert.match(html, /<nav[^>]*aria-label="Report views"/);
  for (const label of ['Specifications', 'Changes', 'Workflow']) assert.match(html, new RegExp(`>${label}(?: <span[^>]*>[^<]*</span>)?</a>`));
  assert.match(html, /aria-current="page"[^>]*>Specifications/);
});
Then('the changes view contains only specifications awaiting acceptance', async function(this: PresentationWorld) {
  const html = await (await driver(this).request('/?view=changes')).text();
  assert.match(html, /<h2>First specification<\/h2>/);
  assert.doesNotMatch(html, /<h2>Second specification<\/h2>/);
  assert.match(html, /class="spec-change"/);
});
Then('the workflow view explains reporting, individual acceptance, verification and mobile review', async function(this: PresentationWorld) {
  const html = await (await driver(this).request('/?view=workflow')).text();
  assert.match(html, /agent-intent\.lock\.json/);
  assert.match(html, /npm run test:lineage/);
  assert.match(html, /npm run intent -- verify/);
  assert.match(html, /npm run intent -- review --output/);
  assert.match(html, /Selection and copying never accept changes/);
  assert.doesNotMatch(html, /Mark as intent|Approve this staged revision|<section[^>]*data-result=/);
});

Then('the Agent Intent report shows the accepted Gherkin alongside its supporting tests', async function (this: PresentationWorld) {
  const response = await driver(this).request('/');
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<h1>Agent Intent report<\/h1>/);
  const first = section(html, 'First specification');
  assert.match(first.replace(/<\/?span\b[^>]*>/g, ''), /class="gherkin-specification"[\s\S]*?Scenario: First specification[\s\S]*?Given the first promise/);
  assert.match(first, /Reporting › supports the first promise/);
  assert.doesNotMatch(first, /class="spec-change"/);
});
Then('the report identifies shared lineage above the supporting tests', async function (this: PresentationWorld) {
  const html = section(await driver(this).page(), 'First specification');
  assert.match(html, /<li[^>]*data-lineage="@first"[^>]*>Reporting › supports the first promise/);
  assert.match(html, /class="scenario-lineage">Lineage IDs: @first<\/p>/);
  assert.doesNotMatch(html, /class="test-lineage"|Reporting › supports the second promise/);
});

Then('each supporting unit test has a collapsed test-code control', async function (this: PresentationWorld) {
  const html = section(await driver(this).page(), 'First specification');
  assert.match(html, /<details class="test-code"><summary aria-label="View test code"[^>]*>/);
  assert.doesNotMatch(html, /<details class="test-code"[^>]*\bopen\b/);
});
Then('expanding the control reveals the actual test declaration and assertions', async function (this: PresentationWorld) {
  const html = section(await driver(this).page(), 'First specification');
  assert.match(html.replace(/<\/?span\b[^>]*>/g, ''), /<details class="test-code">[\s\S]*?<pre><code>[^<]*supports the first promise[^<]*assert\.ok\(true\)[^<]*<\/code><\/pre>[\s\S]*?<\/details>/);
  assert.doesNotMatch(html, /supports the second promise/);
});

Given('its supporting test also has tags {string} and {string}', function (this: PresentationWorld, first: string, second: string) {
  const d = driver(this);
  d.write('example.test.mjs', readFileSync(join(d.root, 'example.test.mjs'), 'utf8')
    .replace("tags:['first']", `tags:['first',${JSON.stringify(first)},${JSON.stringify(second)}]`));
});
Then('the test displays its additional tags without repeating the scenario lineage', async function (this: PresentationWorld) {
  const html = section(await driver(this).page(), 'First specification');
  assert.match(html, /<small class="test-tags">@fast, @smoke<\/small>/);
  assert.doesNotMatch(html, /<small[^>]*>[^<]*@first/);
  assert.match(html, /data-lineage="@first"/);
});

Then('the test-code control is an inline icon labelled for accessibility', async function (this: PresentationWorld) {
  const html = section(await driver(this).page(), 'First specification');
  assert.match(html, /<summary aria-label="View test code" title="View test code"><span aria-hidden="true">&lt;\/&gt;<\/span><\/summary>/);
});

Then('the collapsed test-code view contains syntax highlighting without loading external scripts', async function (this: PresentationWorld) {
  const html = section(await driver(this).page(), 'First specification');
  assert.match(html, /class="hljs-string"/);
  assert.doesNotMatch(html, /<details class="test-code"[^>]*\bopen\b/);
  assert.doesNotMatch(await driver(this).page(), /<script[^>]*src="https?:/);
});

Then('the scenario and test source locations link to their lines in VS Code by default', async function (this: PresentationWorld) {
  const d = driver(this), html = await d.page();
  assert.ok(html.includes(`href="vscode://file${realpathSync(d.root)}/features/example.feature:3:1"`));
  assert.ok(html.includes(`href="vscode://file${realpathSync(d.root)}/example.test.mjs:4:1"`));
});

Then('the Gherkin source and both change previews are syntax-highlighted', async function (this: PresentationWorld) {
  const html = section(await driver(this).page(), 'First specification');
  const blocks = [...html.matchAll(/<pre>(?!<code>)([\s\S]*?)<\/pre>/g)].map(match => match[1]);
  assert.equal(blocks.length, 3);
  for (const block of blocks) assert.match(block, /class="hljs-keyword">Given<\/span>/);
});

Given('a specification with no associated executed tests', function(this: PresentationWorld) {
  this.presentation = new PresentationDriver(); this.presentation.fixtures();
  this.presentation.write('example.test.mjs', "import {it} from 'node:test'; it('unrelated', {tags:['other']}, () => {});");
});
Then('that specification is labelled {string}', async function(this: PresentationWorld, label: string) {
  const html = section(await driver(this).page(), 'First specification');
  assert.match(html, /data-result="not-run"/); assert.ok(html.includes(`>${label}</span>`));
});
Given('a configured IDE template and a test path containing spaces and a hash', function(this: PresentationWorld) {
  const d = driver(this);
  d.write('.agent-intent.json', JSON.stringify({version:1, feature_roots:['features'],
    editor_url_template:'my-ide://open?file={encodedPath}&line={line}&column={column}'}));
  // The normal reporter entry point imports a test whose declaration is in the escaped path.
  d.write('a file #1.test.mjs', "import {it} from 'node:test';\nit('supports a promise', {tags:['first']}, () => {});");
  d.write('example.test.mjs', "import './a file %231.test.mjs';");
});
Then('local and standalone source links use the configured template and escaped path', async function(this: PresentationWorld) {
  const d = driver(this);
  const href = `href="my-ide://open?file=${encodeURIComponent(join(realpathSync(d.root), 'a file #1.test.mjs'))}&amp;line=2&amp;column=1"`;
  assert.ok((await d.page()).includes(href)); assert.ok(d.html().includes(href));
});
Given('the IDE template is {word}', function(this: PresentationWorld, template: string) {
  driver(this).write('.agent-intent.json', JSON.stringify({version:1, feature_roots:['features'], editor_url_template:template}));
});
Given('the IDE template is a non-string value', function(this: PresentationWorld) {
  driver(this).write('.agent-intent.json', JSON.stringify({version:1, feature_roots:['features'], editor_url_template:42}));
});
When('I request the report with that configuration', async function(this: PresentationWorld) {
  // Capture a valid report first; invalid editor settings are tested by the read request.
  const d = driver(this), configuration = readFileSync(join(d.root, '.agent-intent.json'), 'utf8');
  d.write('.agent-intent.json', JSON.stringify({version:1, feature_roots:['features']})); d.run();
  d.write('.agent-intent.json', configuration);
});
Then('the report rejects the invalid IDE template', async function(this: PresentationWorld) {
  assert.equal((await driver(this).request('/')).status, 409);
});

Then('the collapsed scenario row contains its acceptance button', async function(this: PresentationWorld) {
  assert.match(await driver(this).page(), /<summary>[^]*?<button[^>]*data-accept=[^]*?<\/button><\/summary>/);
});

Given('a stop request for this project', function() {});
Then('only an Agent Intent serve process in this project is eligible to stop', async function() {
  const { isProjectService } = await import('../../src/workflow.js');
  assert.equal(isProjectService('/project', '/project', 'node runtime/cli.cjs serve'), true);
  assert.equal(isProjectService('/project', '/other', 'node runtime/cli.cjs serve'), false);
  assert.equal(isProjectService('/project', '/project', 'node other-server.js'), false);
});
