import { logoDataUrl } from './brand.js';
import { editorLink } from '../core/editor.js';
import type { EditorOptions } from '../core/editor.js';
import { highlightedSource } from './highlight.js';
import type { TestSource } from './source.js';
import type { Scenario } from '../core/types.js';
import { lineageStyles } from './style.js';
import { definitionText } from './definition.js';
import type { StoredScenario } from './state.js';
import { groupRows } from './grouping.js';

export interface LineageTest { description: string; tags: readonly string[]; status?: 'passed' | 'failed'; source?: TestSource }
export type LineageScenario = Pick<Scenario, 'id' | 'path' | 'name' | 'tags'> & { key?: string; fingerprint?: string; definition?: string };
export interface ReportOptions { accepted?: readonly StoredScenario[]; sessionToken?: string; revision?: string; runFailed?: boolean; staticReview?: boolean; editor?: EditorOptions; view?: 'specifications' | 'changes' | 'workflow' }

function text(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

const chevron = '<svg class="expand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>';
function resultLabel(result: string): string {
  const label = result === 'passed' ? 'Passed' : result === 'failed' ? 'Failed' : 'Not run';
  return `<span class="badge result-${result}">${label}</span>`;
}

function sourceLocation(path: string, line: number, editor?: EditorOptions): string {
  const href = editorLink(path, line, editor);
  const label = text(path) + (Number.isSafeInteger(line) && line > 0 ? ':' + line : '');
  return href ? `<a href="${text(href)}" title="Open source in IDE">${label}</a>` : label;
}

function testRow(test: LineageTest, parentIds: Set<string>, editor?: EditorOptions): string {
  const shared = [...new Set(test.tags.filter(tag => parentIds.has(tag)))].map(tag => '@' + tag).join(', ');
  const additional = [...new Set(test.tags.filter(tag => !parentIds.has(tag)))].map(tag => '@' + tag).join(', ');
  const code = test.source
    ? `<p class="test-source-location">${sourceLocation(test.source.path, test.source.line, editor)}</p><pre><code>${highlightedSource(test.source.code, test.source.path)}</code></pre>`
    : '<p class="empty">Test code was not captured for this run. Regenerate the report with source files available.</p>';
  return `<li data-result="${test.status ?? 'passed'}" data-lineage="${text(shared)}">${text(test.description)}${resultLabel(test.status ?? 'passed')}${additional ? `<small class="test-tags">${text(additional)}</small>` : ''}<details class="test-code"><summary aria-label="View test code" title="View test code"><span aria-hidden="true">&lt;/&gt;</span></summary>${code}</details></li>`;
}

export function renderLineage(scenarios: readonly LineageScenario[], tests: readonly LineageTest[], options: ReportOptions = {}): string {
  const accepted = new Map((options.accepted ?? []).map(scenario => [scenario.key, scenario]));
  const keys = new Set(scenarios.map(scenario => scenario.key ?? scenario.id));
  const removed = (options.accepted ?? []).filter(scenario => !keys.has(scenario.key));
  const sections = [...scenarios, ...removed].map(scenario => {
    const key = scenario.key ?? scenario.id, previous = accepted.get(key);
    const change = removed.includes(scenario as StoredScenario) ? 'removed' : !previous ? 'added'
      : previous.fingerprint === scenario.fingerprint ? 'unchanged' : 'modified';
    const ids = new Set(scenario.tags.map(tag => tag.slice(1)));
    const related = change === 'removed' ? [] : tests.filter(test => test.tags.some(tag => ids.has(tag)));
    const lineageIds = [...ids].filter(id => related.some(test => test.tags.includes(id)));
    const specification = scenario.definition ? `<div class="gherkin-specification"><h3>Gherkin specification</h3><pre>${highlightedSource(definitionText(scenario.definition), scenario.path)}</pre></div>` : '';
    const result = related.some(test => test.status === 'failed') ? 'failed' : related.length ? 'passed' : 'not-run';
    const changeLabel = change === 'unchanged' ? '' : `<span class="badge change-${change}">${change[0].toUpperCase() + change.slice(1)}</span>`;
    const review = change === 'unchanged' || !scenario.definition ? '' : `<details class="spec-change"><summary>${chevron}Review specification change</summary><div class="comparison"><div><h3>Previously accepted</h3>${previous ? `<pre>${highlightedSource(definitionText(previous.definition), previous.path)}</pre>` : '<p>Not previously accepted.</p>'}</div><div><h3>Current specification</h3>${change === 'removed' ? '<p>Specification removed.</p>' : `<pre>${highlightedSource(definitionText(scenario.definition), scenario.path)}</pre>`}</div></div></details>`;
    const action = options.staticReview ? '' : change === 'unchanged'
      ? '<button type="button" disabled>Accepted</button>'
      : `<button type="button" data-accept="${text(key)}" data-previous="${previous?.fingerprint ?? ''}" aria-label="Accept ${text(scenario.name)}${change === 'removed' ? ' removal' : ''}"${options.sessionToken ? '' : ' disabled'}>Accept${change === 'removed' ? ' removal' : ''}</button>`;
    const selection = options.staticReview && change !== 'unchanged'
      ? `<div class="review-actions"><label class="approval-choice"><input type="checkbox" data-review-key="${text(key)}"> Select approval of this specification ${change === 'removed' ? 'removal' : 'change'}</label></div>` : '';
    return { result, change, html: `<section id="${text(scenario.id + (change === 'removed' ? '-removed' : ''))}" data-result="${result}" data-change="${change}">
<details>
<summary>${chevron}<h2>${text(scenario.name)}</h2>${resultLabel(result)}${changeLabel}${action}</summary>
<p class="path">${sourceLocation(scenario.path, Number(scenario.id.slice(scenario.id.lastIndexOf(':') + 1)), options.editor)}</p>
${specification}
${lineageIds.length ? `<p class="scenario-lineage">Lineage IDs: ${text(lineageIds.map(id => '@' + id).join(', '))}</p>` : ''}
<h3 class="supporting-tests">Supporting unit tests</h3>
${related.length ? `<ul>${related.map(test => testRow(test, ids, options.editor)).join('\n')}</ul>`
      : '<p class="empty">No associated unit tests ran with a matching lineage ID.</p>'}
${review}
${selection}
</details>
</section>` };
  });
  const view = options.sessionToken ? options.view ?? 'specifications' : 'specifications';
  const pending = sections.filter(section => section.change !== 'unchanged');
  const navigation = options.sessionToken ? `<nav class="report-nav" aria-label="Report views">${[
    ['specifications', 'Specifications'], ['changes', 'Changes'], ['workflow', 'Workflow'],
  ].map(([key, label]) => `<a href="/?view=${key}"${view === key ? ' aria-current="page"' : ''}>${label}${key === 'changes' ? ` <span id="pending-count">${pending.length}</span>` : ''}</a>`).join('')}</nav>` : '';
  const workflow = `<article class="workflow">
<h2>From executable examples to accepted specifications</h2>
<p>Each Gherkin scenario describes a specification. Shared lineage IDs connect it to the unit tests that support it.</p>
<div class="workflow-step"><h3>1. Run the tests</h3><p>Generate a fresh report with the current specifications and recorded test outcomes.</p><pre>npm run test:lineage</pre></div>
<div class="workflow-step"><h3>2. Review each change</h3><p>Open Changes to compare accepted and current Gherkin. Expand a scenario to inspect its supporting tests and captured test code.</p><p>Accept updates only that specification in <code>intentdd.lock.json</code>. Test results and specification acceptance are separate.</p></div>
<div class="workflow-step"><h3>3. Verify the report</h3><p>Check that source matches the report, tests passed and every specification matches the accepted lock.</p><pre>npm run intent -- verify</pre></div>
<div class="workflow-step"><h3>Review from your phone</h3><p>Export an HTML review and a text companion using a fresh output prefix. Select individual changes and paste the complete approval blocks into your agent conversation with an instruction to apply them.</p><pre>npm run intent -- review --output reviews/mobile-review</pre><p>Selection and copying never accept changes. Specification acceptance does not approve implementation changes or authorise commits.</p></div>
</article>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Agent Intent report</title>
${options.sessionToken ? `<meta name="agent-intent-token" content="${text(options.sessionToken)}"><meta name="lineage-revision" content="${text(options.revision ?? '')}"><link rel="stylesheet" href="/lineage.css"><script src="/lineage.js" defer></script>` : `<style>${lineageStyles}</style>`}
</head>
<body>
<header>
<img class="brand-logo" src="${logoDataUrl}" alt="Agent Intent: a secret agent peeking out of a tent" width="216" height="144">
<h1>Agent Intent report</h1>
<p>Specifications and the tests that support them.</p>
${options.sessionToken ? '<a class="refresh-report" href="">Refresh report</a>' : ''}
</header>
<main>
${navigation}
${options.runFailed ? '<p class="message error" role="alert">Test run failed. Review test output for failures outside individual tests.</p>' : ''}
${view === 'workflow' ? workflow : `
${options.sessionToken ? `<div class="view-heading"><h2>${view === 'changes' ? 'Specification changes' : 'Specifications and supporting tests'}</h2><p>${view === 'changes' ? 'Compare each proposed definition with its accepted baseline.' : `${scenarios.length} specifications · ${tests.length} recorded tests`}</p></div>` : ''}
<p>Select a scenario to read its Gherkin and associated unit-test descriptions. Select it again to collapse the list.</p>
<div class="legend"><span class="legend-label">Test results</span>${resultLabel('passed')}${resultLabel('failed')}${resultLabel('not-run')}</div>
<div class="legend"><span class="legend-label">Since individual acceptance</span><span class="badge change-added">Added</span><span class="badge change-modified">Modified</span><span class="badge change-removed">Removed</span></div>
<p class="help">${options.staticReview ? 'Review each change, then select only the specifications you approve. Copy your approval text and paste it into the agent conversation. This file never updates acceptance.' : options.sessionToken ? 'Accept each specification independently. Acceptance updates only that specification in intentdd.lock.json.' : 'To accept individual specification changes, run npm start and <a href="http://127.0.0.1:8765/lineage">open the local review interface</a> (or use the printed port followed by /lineage).'}</p>
<p class="message" role="status" id="lineage-message"></p>
<div id="scenario-groups"${view === 'changes' ? ' data-changes-only' : ''}>${groupRows(view === 'changes' ? pending : sections)}</div>
${view === 'changes' ? `<p id="changes-empty" class="review-empty"${pending.length ? ' hidden' : ''}>No specification changes awaiting acceptance. <a href="/?view=specifications">Browse all specifications</a>.</p>` : ''}
`}
</main>
</body>
</html>
`;
}
