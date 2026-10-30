import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { LineageDriver } from '../features/support/lineage-driver.js';
import { renderLineage } from '../src/lineage/report.js';

const lineage = { tags: ['test-lineage'] };
const scenario = { id: 'features/report.feature:4', path: 'features/report.feature',
  name: 'Generate lineage HTML', tags: ['@test-lineage'] };

describe('Lineage descriptions', () => {
  it('reveals related descriptions through a collapsed scenario control', lineage, () => {
    const html = renderLineage([scenario], [
      { description: 'HTML reporting › lists related tests', tags: ['test-lineage'] },
    ]);
    assert.match(html, /<details>\s*<summary>[\s\S]*?<h2>Generate lineage HTML<\/h2>[\s\S]*?<\/summary>[\s\S]*?<li[^>]*>HTML reporting › lists related tests<span[^>]*>Passed<\/span><details class="test-code">[\s\S]*?<\/details><\/li>[\s\S]*?<\/details>/);
    assert.doesNotMatch(html, /<details\b[^>]*\bopen\b/);
  });

  it('explains when a scenario has no associated tests in the run', lineage, () => {
    const html = renderLineage([scenario], [
      { description: 'An unrelated test', tags: ['another-requirement'] },
    ]);
    assert.match(html, /<summary>[\s\S]*?<h2>Generate lineage HTML<\/h2>[\s\S]*?<\/summary>/);
    assert.match(html, /No associated unit tests ran with a matching lineage ID\./);
    assert.doesNotMatch(html, /An unrelated test/);
  });

  it('lists only tests with an exact matching lineage ID', lineage, () => {
    const html = renderLineage([scenario], [
      { description: 'HTML reporting › lists related tests', tags: ['test-lineage'] },
      { description: 'HTML reporting › ignores unrelated tests', tags: ['test-lineage'] },
      { description: 'An unrelated test', tags: ['test-lineage-other'] },
      { description: 'An untagged test', tags: [] },
    ]);
    assert.match(html, /<h2>Generate lineage HTML<\/h2>/);
    assert.match(html, /<li[^>]*>HTML reporting › lists related tests<span[^>]*>Passed<\/span><details class="test-code">[\s\S]*?<\/details><\/li>/);
    assert.match(html, /<li[^>]*>HTML reporting › ignores unrelated tests<span[^>]*>Passed<\/span><details class="test-code">[\s\S]*?<\/details><\/li>/);
    assert.doesNotMatch(html, /An unrelated test|An untagged test/);
  });

  it('keeps each scenario associated with its own tests', lineage, () => {
    const html = renderLineage([scenario, { ...scenario, id: 'features/report.feature:9',
      name: 'Another requirement', tags: ['@another-requirement'] }], [
      { description: 'First supporting test', tags: ['test-lineage'] },
      { description: 'Second supporting test', tags: ['another-requirement'] },
    ]);
    const sections = [...html.matchAll(/<section\b[^>]*>([\s\S]*?)<\/section>/g)];
    assert.equal(sections.length, 2);
    assert.match(sections[0][1], /First supporting test/);
    assert.doesNotMatch(sections[0][1], /Second supporting test/);
    assert.match(sections[1][1], /Second supporting test/);
    assert.doesNotMatch(sections[1][1], /First supporting test/);
  });

  it('lists a test once per scenario when several tags match', lineage, () => {
    const html = renderLineage([{ ...scenario, tags: ['@test-lineage', '@reporting'] }], [
      { description: 'Shared supporting test', tags: ['test-lineage', 'reporting'] },
    ]);
    assert.equal(html.match(/<li[^>]*>Shared supporting test<span[^>]*>Passed<\/span><details class="test-code">[\s\S]*?<\/details><\/li>/g)?.length, 1);
  });

  it('renders scenario and test descriptions as text', lineage, () => {
    const html = renderLineage([{ ...scenario, name: '<script>alert("scenario")</script>',
      path: '<img src=x onerror=alert(1)>' }], [
      { description: '<script>alert("test")</script> & comparison', tags: ['test-lineage'] },
    ]);
    assert.match(html, /&lt;script&gt;alert\(&quot;scenario&quot;\)&lt;\/script&gt;/);
    assert.match(html, /&lt;script&gt;alert\(&quot;test&quot;\)&lt;\/script&gt; &amp; comparison/);
    const content = html.match(/<main>([\s\S]*?)<\/main>/)?.[1];
    assert.ok(content, 'Missing report content');
    assert.match(content, /&lt;img src=x onerror=alert\(1\)&gt;/);
    assert.doesNotMatch(content, /<script\b|<img\b/i);
  });
});

describe('Lineage reporter test runs', () => {
  let d: LineageDriver;
  beforeEach(() => { d = new LineageDriver(); d.scenario('test-lineage'); });
  afterEach(() => { d.close(); });

  it('retains nested BDD descriptions across concurrent suites and files', lineage, () => {
    d.write('first.test.mjs', `import { describe, it } from 'node:test';
describe('First suite', { concurrency: true }, () => {
  describe('Slow branch', () => {
    it('finishes later', { tags: ['test-lineage'] }, async () => {
      await new Promise(resolve => setTimeout(resolve, 20));
    });
  });
  describe('Fast branch', () => {
    it('finishes sooner', { tags: ['test-lineage'] }, () => {});
  });
});`);
    d.write('second.test.mjs', `import { describe, it } from 'node:test';
describe('Second suite', () => {
  it('belongs to the second file', { tags: ['test-lineage'] }, () => {});
});`);
    d.run(['first.test.mjs', 'second.test.mjs']);
    const html = d.html();
    assert.match(html, /<li[^>]*>First suite › Slow branch › finishes later<span[^>]*>Passed<\/span><details class="test-code">[\s\S]*?<\/details><\/li>/);
    assert.match(html, /<li[^>]*>First suite › Fast branch › finishes sooner<span[^>]*>Passed<\/span><details class="test-code">[\s\S]*?<\/details><\/li>/);
    assert.match(html, /<li[^>]*>Second suite › belongs to the second file<span[^>]*>Passed<\/span><details class="test-code">[\s\S]*?<\/details><\/li>/);
  });

  it('lists tests that actually ran rather than skipped tests or suite containers', lineage, () => {
    d.write('example.test.mjs', `import { describe, it } from 'node:test';
describe('Supporting suite', { tags: ['test-lineage'] }, () => {
  it('runs its assertions', () => {});
  it.skip('was skipped', () => {});
});`);
    d.run();
    const html = d.html();
    assert.match(html, /<li[^>]*>Supporting suite › runs its assertions<span[^>]*>Passed<\/span><details class="test-code">[\s\S]*?<\/details><\/li>/);
    assert.doesNotMatch(html, /was skipped|<li[^>]*>Supporting suite<span/);
  });

  it('retains the enclosing suite when a helper declares a test', lineage, () => {
    d.write('helper.mjs', `import { it } from 'node:test';
export function check() { it('helper assertion', { tags: ['test-lineage'] }, () => {}); }`);
    d.write('example.test.mjs', `import { describe } from 'node:test';
import { check } from './helper.mjs';
describe('Outer suite', () => { check(); });`);
    d.run();
    assert.match(d.html(), /<li[^>]*>Outer suite › helper assertion<span[^>]*>Passed<\/span><details class="test-code">[\s\S]*?<\/details><\/li>/);
  });

  it('keeps shared helper descriptions separate across test workers', lineage, () => {
    d.write('helper.mjs', `import { describe, it } from 'node:test';
export function check(name) {
  describe(name, () => {
    it('helper assertion', { tags: ['test-lineage'] }, () => {});
  });
}`);
    d.write('first.test.mjs', `import { check } from './helper.mjs'; check('First suite');`);
    d.write('second.test.mjs', `import { check } from './helper.mjs'; check('Second suite');`);
    d.run(['first.test.mjs', 'second.test.mjs']);
    const html = d.html();
    assert.equal(html.match(/<li[^>]*>First suite › helper assertion<span[^>]*>Passed<\/span><details class="test-code">[\s\S]*?<\/details><\/li>/g)?.length, 1);
    assert.equal(html.match(/<li[^>]*>Second suite › helper assertion<span[^>]*>Passed<\/span><details class="test-code">[\s\S]*?<\/details><\/li>/g)?.length, 1);
  });

  it('reads configured feature roots including nested feature files', lineage, () => {
    d.write('.intentdd.json', JSON.stringify({ version: 1, feature_roots: ['requirements'] }));
    d.write('requirements/nested/report.feature', `Feature: Configured requirements
  @test-lineage
  Scenario: Use the configured feature root
    Given supporting tests
`);
    d.unitTests('test-lineage');
    d.run();
    assert.match(d.html(), /<h2>Use the configured feature root<\/h2>/);
    assert.doesNotMatch(d.html(), /List supporting unit tests/);
  });
});
