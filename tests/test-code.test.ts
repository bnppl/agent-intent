import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PresentationDriver } from '../features/support/presentation-driver.js';
import { fileURLToPath } from 'node:url';
import { sourceReader } from '../src/lineage/source.js';
import { renderLineage } from '../src/lineage/report.js';

const tag = { tags: ['test-code'] };

describe('Supporting unit-test code', () => {
  it('captures just the executed test declaration and shows it in a collapsed control', tag, async () => {
    const d = new PresentationDriver();
    try {
      d.fixtures(); d.run();
      const response = await d.request('/');
      const html = await response.text();
      assert.match(html, /<details class="test-code"><summary aria-label="View test code" title="View test code"><span aria-hidden="true">&lt;\/&gt;<\/span><\/summary>/);
      assert.doesNotMatch(html, /<details class="test-code"[^>]*\bopen\b/);
      const model = await d.model();
      const first = model.snapshot.tests[0] as typeof model.snapshot.tests[0] & { source?: {path: string; line: number; code: string} };
      assert.equal(first.source?.path, 'example.test.mjs');
      assert.equal(first.source?.line, 4);
      assert.equal(first.source?.code, "it('supports the first promise', {tags:['first']}, () => assert.ok(true))");
      assert.match(html.replace(/<\/?span\b[^>]*>/g, ''), /assert\.ok\(true\)/);
      assert.match(d.html(), /<details class="test-code">/);
      // Source is captured with the run, not reread from a subsequently edited file.
      d.write('example.test.mjs', 'throw Error("new source");');
      assert.match((await d.page()).replace(/<\/?span\b[^>]*>/g, ''), /assert\.ok\(true\)/);
    } finally { await d.stop(); }
  });

  it('uses declaration locations for helper-defined tests and handles braces inside strings', tag, () => {
    const d = new PresentationDriver();
    try {
      d.fixtures();
      d.write('helper.mjs', `import { it } from 'node:test';
import assert from 'node:assert/strict';
export function check() {
  it('checks braces', {tags:['first']}, () => {
    const value = '}'; // not the end of the callback
    assert.equal(value, '}');
  });
}`);
      d.write('example.test.mjs', `import { describe } from 'node:test';
import { check } from './helper.mjs';
describe('Outer', () => check());`);
      d.run();
      const snapshot = JSON.parse(readFileSync(join(d.root, '.intentdd/lineage/latest.json'), 'utf8'));
      assert.equal(snapshot.tests[0].source?.path, 'helper.mjs');
      assert.match(snapshot.tests[0].source?.code ?? '', /assert\.equal\(value, '\}'\);/);
      assert.doesNotMatch(snapshot.tests[0].source?.code ?? '', /export function|import/);
    } finally { d.close(); }
  });

  it('captures original TypeScript declarations when a loader transforms the test file', tag, () => {
    const d = new PresentationDriver();
    try {
      d.fixtures();
      d.write('example.test.ts', `import { it } from 'node:test';
import assert from 'node:assert/strict';

type Value = { count: number };

it('checks a typed value', {tags:['first']}, () => {
  const value: Value = {count: 2};
  assert.equal(value.count, 2);
});

it('checks another value', {tags:['second']}, () => {
  assert.ok(true);
});`);
      d.run(['example.test.ts'], 0, ['--import', fileURLToPath(new URL('../node_modules/tsx/dist/loader.mjs', import.meta.url))]);
      const snapshot = JSON.parse(readFileSync(join(d.root, '.intentdd/lineage/latest.json'), 'utf8'));
      assert.equal(snapshot.tests[0].source?.line, 6);
      assert.match(snapshot.tests[0].source?.code ?? '', /const value: Value =/);
      assert.doesNotMatch(snapshot.tests[0].source?.code ?? '', /checks another value/);
      assert.match(snapshot.tests[1].source?.code ?? '', /^it\('checks another value'/);
    } finally { d.close(); }
  });

  it('does not substitute an enclosing suite when a source location is inside the callback', tag, () => {
    const d = new PresentationDriver();
    try {
      d.write('example.test.mjs', `describe('A suite', () => {
  it('A test', () => {
    const value = 2;
  });
});`);
      const source = sourceReader(d.root)({file: join(d.root, 'example.test.mjs'), line: 3, column: 5});
      assert.equal(source, undefined);
    } finally { d.close(); }
  });

  it('escapes test code and explains missing source in older reports', tag, () => {
    const scenario = {id: 's', path: 's.feature', name: 'A promise', tags:['@promise']};
    const test = {description: 'supports the promise', tags:['promise'], source: {path:'spec.mjs', line:1,
      code: `it('supports the promise', () => assert.equal('<script>alert(1)</script>', ''))`}};
    const html = renderLineage([scenario], [test]);
    assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.doesNotMatch(html, /<script>alert/);
    const old = renderLineage([scenario], [{description:'legacy test', tags:['promise']}]);
    assert.match(old, /Test code was not captured for this run/);
    assert.match(old, /legacy test/);
  });
});
