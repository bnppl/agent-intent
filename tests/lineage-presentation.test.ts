import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderLineage } from '../src/lineage/report.js';
import { definitionText } from '../src/lineage/definition.js';
import { PresentationDriver } from '../features/support/presentation-driver.js';

const scenario = { id: 'spec.feature:3', path: 'spec.feature', name: 'A promise', tags: ['@promise'] };

describe('Report presentation', () => {
  it('groups failures first and separates change states within each run status', { tags: ['report-grouping'] }, () => {
    const definition = JSON.stringify({ contexts: [], scenario: { keyword: 'Scenario', name: 'A promise' } });
    const changed = { ...scenario, id: 'spec.feature:3', key: 'changed', name: 'Changed passing', fingerprint: 'new', definition };
    const unchanged = { ...scenario, id: 'spec.feature:6', key: 'unchanged', name: 'Unchanged failing', tags: ['@failure'], fingerprint: 'same', definition };
    const added = { ...scenario, id: 'spec.feature:9', key: 'added', name: 'Added passing' };
    const unrun = { ...scenario, id: 'spec.feature:12', key: 'unrun', name: 'Added unexecuted', tags: ['@unrun'] };
    const html = renderLineage([changed, unchanged, added, unrun], [
      { description: 'passing check', tags: ['promise'], status: 'passed' },
      { description: 'failing check', tags: ['failure'], status: 'failed' },
    ], { accepted: [{ ...changed, fingerprint: 'old' }, unchanged] }).split('<body>')[1];
    const failedAt = html.indexOf('data-run-group="failed"');
    const passedAt = html.indexOf('data-run-group="passed"');
    const unrunAt = html.indexOf('data-run-group="not-run"');
    assert.ok(failedAt >= 0 && failedAt < passedAt && passedAt < unrunAt);
    const failed = html.slice(failedAt, passedAt), passed = html.slice(passedAt, unrunAt), notRun = html.slice(unrunAt);
    assert.match(failed, /data-change-group="unchanged"[\s\S]*?<h2>Unchanged failing<\/h2>/);
    assert.doesNotMatch(failed, /<h2>Changed passing<\/h2>|<h2>Added passing<\/h2>/);
    assert.match(passed, /data-change-group="added"[\s\S]*?<h2>Added passing<\/h2>/);
    assert.match(passed, /data-change-group="modified"[\s\S]*?<h2>Changed passing<\/h2>/);
    assert.doesNotMatch(passed, /<h2>Unchanged failing<\/h2>|<h2>Added unexecuted<\/h2>/);
    assert.match(notRun, /data-change-group="added"[\s\S]*?<h2>Added unexecuted<\/h2>/);
    assert.match(passed, /data-group-count>2 specifications<\/span>/);
  });

  it('omits empty groups instead of presenting empty status categories', { tags: ['report-grouping'] }, () => {
    const html = renderLineage([scenario], [{ description: 'a check', tags: ['promise'] }]).split('<body>')[1];
    assert.match(html, /data-run-group="passed"/);
    assert.match(html, /data-change-group="added"/);
    assert.doesNotMatch(html, /data-run-group="failed"|data-run-group="not-run"|data-change-group="unchanged"/);
  });

  it('retains Examples descriptions when displaying specification changes', { tags: ['specification-semantics'] }, () => {
    const definition = { contexts: [], scenario: { keyword: 'Scenario Outline', name: 'A promise',
      examples: [{ keyword: 'Examples', name: 'Inputs', description: 'These inputs are authoritative.',
        tags: [], tableBody: [] }] } };
    assert.match(definitionText(JSON.stringify(definition)), /These inputs are authoritative\./);
    definition.scenario.examples[0].description = 'These inputs are illustrative.';
    assert.match(definitionText(JSON.stringify(definition)), /These inputs are illustrative\./);
  });

  it('shows an authored expansion icon with an expanded-state style', { tags: ['report-expansion'] }, () => {
    const html = renderLineage([scenario], [{ description: 'supports the promise', tags: ['promise'] }]);
    assert.match(html, /<svg[^>]*class="expand-icon"/);
    assert.match(html, /details\[open\][^{]*\.expand-icon/);
  });

  it('shows separate result colours and text for passed and failed tests', { tags: ['report-results'] }, () => {
    const html = renderLineage([scenario], [
      { description: 'passing example', tags: ['promise'], status: 'passed' },
      { description: 'failing example', tags: ['promise'], status: 'failed' },
    ]);
    assert.match(html, /data-result="passed"/);
    assert.match(html, /data-result="failed"/);
    assert.match(html, />Passed<\/span>/);
    assert.match(html, />Failed<\/span>/);
    assert.match(html, /--passed:\s*#205545/);
    assert.match(html, /--failed:\s*#a13930/);
    assert.match(html, /<section[^>]*data-result="failed"/);
  });

  it('generates failure results without hiding the runner failure', { tags: ['report-results'] }, () => {
    const d = new PresentationDriver();
    try {
      d.fixtures();
      d.write('example.test.mjs', `import { it } from 'node:test';
it('fails the promise', {tags:['first']}, () => { throw Error('intentional fixture failure'); });`);
      d.run(['example.test.mjs'], 1);
      assert.match(d.html(), /fails the promise/);
      assert.match(d.html(), /data-result="failed"/);
    } finally { d.close(); }
  });

  it('keeps unexecuted specifications neutral instead of claiming they passed', { tags: ['report-unexecuted'] }, () => {
    assert.match(renderLineage([scenario], []), /data-result="not-run"/);
    assert.match(renderLineage([scenario], []), />Not run<\/span>/);
  });
});

describe('Individual specification acceptance', () => {
  it('ignores source-line movement while retaining inherited background changes', { tags: ['specification-semantics'] }, async () => {
    const d = new PresentationDriver();
    try {
      d.fixtures();
      d.write('features/example.feature', readFileSync(join(d.root, 'features/example.feature'), 'utf8')
        .replace('Feature: Reporting', 'Feature: Reporting\n  Background:\n    Given shared setup'));
      d.run();
      for (const name of ['First specification', 'Second specification']) {
        assert.equal((await d.accept(name)).status, 200);
      }
      d.write('features/example.feature', '\n\n' + readFileSync(join(d.root, 'features/example.feature'), 'utf8'));
      d.run();
      assert.doesNotMatch(await d.page(), /data-change="modified"/);
      d.write('features/example.feature', readFileSync(join(d.root, 'features/example.feature'), 'utf8')
        .replace('shared setup', 'changed shared setup'));
      d.run();
      assert.equal((await d.page()).match(/data-change="modified"/g)?.length, 2);
    } finally { await d.stop(); }
  });

  it('requires a session token and rejects a stale per-specification acceptance', { tags: ['acceptance-freshness'] }, async () => {
    const d = new PresentationDriver();
    try {
      d.fixtures(); d.run();
      const model = await d.model();
      const body = { revision: model.revision, key: model.snapshot.scenarios[0].key, expectedAcceptance: null };
      assert.equal((await d.request('/api/lineage/accept', body, '')).status, 403);
      assert.equal((await d.accept('First specification')).status, 200);
      assert.equal((await d.request('/api/lineage/accept', body)).status, 409);
    } finally { await d.stop(); }
  });

  it('rejects an older report after a different test run has replaced it', { tags: ['acceptance-freshness'] }, async () => {
    const d = new PresentationDriver();
    try {
      d.fixtures(); d.run();
      const model = await d.model();
      d.write('example.test.mjs', readFileSync(join(d.root, 'example.test.mjs'), 'utf8')
        .replace('supports the first promise', 'checks the first promise again'));
      d.run();
      const response = await d.request('/api/lineage/accept', { revision: model.revision,
        key: model.snapshot.scenarios[0].key, expectedAcceptance: null });
      assert.equal(response.status, 409);
    } finally { await d.stop(); }
  });

  it('shows the accepted and current Gherkin before a change is accepted', { tags: ['report-change-markers'] }, async () => {
    const d = new PresentationDriver();
    try {
      await d.acceptInitial();
      d.write('features/example.feature', readFileSync(join(d.root, 'features/example.feature'), 'utf8')
        .replace('the first promise', 'a changed first promise'));
      d.run();
      const html = await d.page();
      const sections = [...html.matchAll(/<section\b[^>]*>[\s\S]*?<\/section>/g)].map(match => match[0]);
      const changed = sections.find(section => section.includes('<h2>First specification</h2>'))!;
      const unchanged = sections.find(section => section.includes('<h2>Second specification</h2>'))!;
      assert.match(changed, /data-change="modified"/);
      assert.match(changed, /class="badge result-passed">Passed<\/span>/);
      assert.match(changed, /class="badge change-modified">Modified<\/span>/);
      assert.doesNotMatch(unchanged, /change-modified|data-change="modified"/);
      assert.match(html.replace(/<\/?span\b[^>]*>/g, ''), /<pre>[^<]*Given the first promise[^<]*<\/pre>/);
      assert.match(html.replace(/<\/?span\b[^>]*>/g, ''), /<pre>[^<]*Given a changed first promise[^<]*<\/pre>/);
    } finally { await d.stop(); }
  });

  it('accepts only the selected changed specification and persists that baseline', { tags: ['report-individual-acceptance'] }, async () => {
    const d = new PresentationDriver();
    try {
      await d.acceptInitial();
      d.write('features/example.feature', readFileSync(join(d.root, 'features/example.feature'), 'utf8')
        .replace('the first promise', 'a changed first promise').replace('the second promise', 'a changed second promise'));
      d.run();
      assert.equal((await d.page()).match(/data-change="modified"/g)?.length, 2);
      const response = await d.accept('First specification');
      assert.equal(response.status, 200, await response.text());
      d.run();
      const html = await d.page();
      assert.equal(html.match(/data-change="modified"/g)?.length, 1);
      assert.match(html, /data-change="modified"[\s\S]*?<h2>Second specification<\/h2>/);
      assert.match(html, /data-change="unchanged"[\s\S]*?<h2>First specification<\/h2>/);
    } finally { await d.stop(); }
  });

  it('does not advance acceptance when another report is generated', { tags: ['report-baseline'] }, async () => {
    const d = new PresentationDriver();
    try {
      await d.acceptInitial();
      const baseline = readFileSync(join(d.root, 'intentdd.lock.json'), 'utf8');
      d.write('features/example.feature', readFileSync(join(d.root, 'features/example.feature'), 'utf8')
        .replace('the first promise', 'a changed promise'));
      d.run(); d.run();
      assert.match(await d.page(), /data-change="modified"/);
      assert.equal(readFileSync(join(d.root, 'intentdd.lock.json'), 'utf8'), baseline);
    } finally { await d.stop(); }
  });

  it('rejects acceptance of a report after its source has changed', { tags: ['acceptance-freshness'] }, async () => {
    const d = new PresentationDriver();
    try {
      d.fixtures(); d.run();
      const model = await d.model(), first = model.snapshot.scenarios[0];
      d.write('features/example.feature', readFileSync(join(d.root, 'features/example.feature'), 'utf8')
        .replace('the first promise', 'a newer promise'));
      const response = await d.request('/api/lineage/accept', { revision: model.revision,
        key: first.key, expectedAcceptance: null });
      assert.equal(response.status, 409);
    } finally { await d.stop(); }
  });

  it('marks additions and removals against accepted specifications', { tags: ['report-additions-removals'] }, async () => {
    const d = new PresentationDriver();
    try {
      await d.acceptInitial();
      d.write('features/example.feature', `Feature: Reporting
  @first
  Scenario: First specification
    Given the first promise
  @third
  Scenario: Third specification
    Given another promise
`);
      d.run();
      const html = await d.page();
      assert.match(html, /data-change="added"[\s\S]*?<h2>Third specification<\/h2>/);
      assert.match(html, /data-change="removed"[\s\S]*?<h2>Second specification<\/h2>/);
    } finally { await d.stop(); }
  });
});

it('offers acceptance in the collapsed scenario row and marks unchanged scenarios accepted', { tags: ['inline-acceptance'] }, () => {
  const current = { ...scenario, key: 'promise', fingerprint: 'same', definition: JSON.stringify({ contexts: [], scenario: { keyword: 'Scenario', name: 'A promise' } }) };
  const html = renderLineage([current], [], { sessionToken: 'token' });
  const summary = html.match(/<summary>(.*?)<\/summary>/s)?.[1] ?? '';
  assert.match(summary, /<button[^>]*data-accept="promise"[^>]*>Accept<\/button>/);
  assert.equal((html.match(/data-accept=/g) ?? []).length, 1);
  const accepted = renderLineage([current], [], { sessionToken: 'token', accepted: [current] });
  assert.match(accepted, /<button[^>]*disabled[^>]*>Accepted<\/button>/);
  assert.doesNotMatch(accepted, /data-accept=/);
});
