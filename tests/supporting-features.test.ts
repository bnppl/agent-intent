import { it } from 'node:test';
import assert from 'node:assert/strict';
import { renderLineage, type LineageScenario } from '../src/lineage/report.js';
const definition = JSON.stringify({ contexts: [], scenario: { keyword: 'Scenario', name: 'Choose', steps: [{ keyword: 'Given ', text: 'toys exist' }, { keyword: 'When ', text: 'I choose' }] } });
const scenario = (id: string, tags: string[], path = 'features/root.feature'): LineageScenario => ({ id, name: id, path, tags, definition });
it('links an unlogged step to independent subsystem results and preserves evidence', { tags: ['supporting-feature-navigation'] }, () => {
  const html = renderLineage([scenario('parent', ['@choose', '@e2e']), scenario('api', ['@list-api', '@api', '@supports:choose:1'], 'features/api.feature'), scenario('frontend', ['@list-ui', '@frontend', '@supports:choose:1'], 'features/ui.feature')], [{ description: 'API works', tags: ['list-api'], status: 'passed', source: { path: 'api.test.ts', line: 1, code: 'assert.ok(response)' } }]);
  assert.match(html, /data-support-link/);
  assert.match(html, /data-support-view/);
  assert.ok(html.includes('>Components'), 'The component view uses the requested name');
  assert.ok(!html.includes('>Supporting features'), 'The former UI label is absent');
  assert.match(html, /Back to originating step/);
  assert.match(html, /data-support-library/);
  assert.match(html, /class="badge layer-badge">API/);
  assert.match(html, /class="badge layer-badge">Frontend/);
  assert.match(html, /id="parent" data-result="not-run"/);
  assert.match(html, /API works/);
  assert.match(html, /api.test.ts/);
});
it('diagnoses missing, ambiguous, out-of-range and cyclic references without hiding them', { tags: ['supporting-feature-diagnostics'] }, () => {
  const html = renderLineage([scenario('one', ['@same', '@one', '@supports:two:1']), scenario('two', ['@same', '@two', '@supports:one:1']), scenario('missing', ['@supports:absent:1']), scenario('ambiguous', ['@supports:same:1']), scenario('range', ['@supports:one:99'])], []);
  for (const message of ['Missing supporting target', 'Ambiguous supporting target', 'Step out of range', 'Cyclic supporting relationship']) assert.ok(html.includes(message), message);
  assert.match(html, /id="missing" data-result/);
});
it('keeps old reports free of supporting-feature views', () => {
  const html = renderLineage([scenario('legacy', ['@old'])], []);
  assert.doesNotMatch(html, /<article[^>]* data-support-view/);
});

it('keeps layer tags out of lineage aggregation and escapes invalid metadata', () => {
  const html = renderLineage([scenario('parent', ['@choose', '@e2e']), scenario('api', ['@api', '@supports:choose:1']), scenario('unsafe', ['@supports:<script>:1'])], [{ description: 'Unrelated E2E', tags: ['e2e'], status: 'passed' }, { description: 'API only', tags: ['api'], status: 'passed' }]);
  assert.match(html, /id="parent" data-result="not-run"/);
  assert.match(html, /id="api" data-result="not-run"/);
  assert.match(html, /Missing supporting target: @supports:&lt;script&gt;:1/);
  assert.equal(html.match(/id="api" data-result=/g)?.length, 1);
});

it('groups features by explicit component names without using those names as test lineage', { tags: ['component-grouping'] }, () => {
  const html = renderLineage([
    scenario('parent', ['@choose']),
    scenario('catalogue', ['@catalogue', '@component:Game-API', '@supports:choose:1'], 'features/catalogue.feature'),
    scenario('health', ['@health', '@component:Game-API', '@supports:choose:1'], 'features/health.feature'),
    scenario('ui', ['@ui', '@component:Web-App', '@supports:choose:1'], 'features/ui.feature'),
    scenario('other', ['@other', '@supports:choose:1'], 'features/other.feature'),
  ], [{ description: 'unrelated', tags: ['component:Game-API'], status: 'passed' }]);
  assert.equal((html.match(/data-component="Game API"/g) ?? []).length, 1, 'API features share a single named component group');
  assert.ok(html.includes('data-component="Web App"'));
  assert.ok(html.includes('data-component="Other components"'), 'unassigned features remain available');
  assert.ok(html.indexOf('data-support-child="health"') < html.indexOf('data-component="Web App"'));
  assert.match(html, /id="catalogue" data-result="not-run"/);
});
