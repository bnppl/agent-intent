import type { Scenario } from '../core/types.js';
import { lineageStyles } from './style.js';
import { definitionText } from './definition.js';
import type { StoredScenario } from './state.js';
import { groupRows } from './grouping.js';

export interface LineageTest { description: string; tags: readonly string[]; status?: 'passed' | 'failed' }
export type LineageScenario = Pick<Scenario, 'id' | 'path' | 'name' | 'tags'> & { key?: string; fingerprint?: string; definition?: string };
export interface ReportOptions { accepted?: readonly StoredScenario[]; sessionToken?: string; revision?: string; runFailed?: boolean; staticReview?: boolean }

function text(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

const chevron = '<svg class="expand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>';
function resultLabel(result: string): string {
  const label = result === 'passed' ? 'Passed' : result === 'failed' ? 'Failed' : 'Not run';
  return `<span class="badge result-${result}">${label}</span>`;
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
    const specification = scenario.definition ? `<div class="gherkin-specification"><h3>Gherkin specification</h3><pre>${text(definitionText(scenario.definition))}</pre></div>` : '';
    const result = related.some(test => test.status === 'failed') ? 'failed' : related.length ? 'passed' : 'not-run';
    const changeLabel = change === 'unchanged' ? '' : `<span class="badge change-${change}">${change[0].toUpperCase() + change.slice(1)}</span>`;
    const review = change === 'unchanged' || !scenario.definition ? '' : `<details class="spec-change"><summary>${chevron}Review specification change</summary><div class="comparison"><div><h3>Previously accepted</h3>${previous ? `<pre>${text(definitionText(previous.definition))}</pre>` : '<p>Not previously accepted.</p>'}</div><div><h3>Current specification</h3>${change === 'removed' ? '<p>Specification removed.</p>' : `<pre>${text(definitionText(scenario.definition))}</pre>`}</div></div></details>`;
    const action = change === 'unchanged' ? '' : options.staticReview
      ? `<div class="review-actions"><label class="approval-choice"><input type="checkbox" data-review-key="${text(key)}"> Select approval of this specification ${change === 'removed' ? 'removal' : 'change'}</label></div>`
      : `<div class="review-actions"><button type="button" data-accept="${text(key)}" data-previous="${previous?.fingerprint ?? ''}"${options.sessionToken ? '' : ' disabled'}>Accept this specification${change === 'removed' ? ' removal' : ' change'}</button></div>`;
    return { result, change, html: `<section id="${text(scenario.id + (change === 'removed' ? '-removed' : ''))}" data-result="${result}" data-change="${change}">
<details>
<summary>${chevron}<h2>${text(scenario.name)}</h2>${resultLabel(result)}${changeLabel}</summary>
<p class="path">${text(scenario.path)}</p>
${specification}
${lineageIds.length ? `<p class="scenario-lineage">Lineage IDs: ${text(lineageIds.map(id => '@' + id).join(', '))}</p>` : ''}
<h3 class="supporting-tests">Supporting unit tests</h3>
${related.length ? `<ul>${related.map(test => `<li data-result="${test.status ?? 'passed'}" data-lineage="${text(test.tags.filter(tag => ids.has(tag)).map(tag => '@' + tag).join(', '))}">${text(test.description)}${resultLabel(test.status ?? 'passed')}<small class="test-lineage">Lineage: ${text(test.tags.filter(tag => ids.has(tag)).map(tag => '@' + tag).join(', '))}</small></li>`).join('\n')}</ul>`
      : '<p class="empty">No associated unit tests ran with a matching lineage ID.</p>'}
${review}
${action}
</details>
</section>` };
  });
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Intent DD report</title>
${options.sessionToken ? `<meta name="intent-dd-token" content="${text(options.sessionToken)}"><meta name="lineage-revision" content="${text(options.revision ?? '')}"><link rel="stylesheet" href="/lineage.css"><script src="/lineage.js" defer></script>` : `<style>${lineageStyles}</style>`}
</head>
<body>
<header>
<h1>Intent DD report</h1>
<p>Specifications and the tests that support them.</p>
</header>
<main>
${options.runFailed ? '<p class="message error" role="alert">Test run failed. Review test output for failures outside individual tests.</p>' : ''}
<p>Select a scenario to read its Gherkin and associated unit-test descriptions. Select it again to collapse the list.</p>
<div class="legend"><span class="legend-label">Test results</span>${resultLabel('passed')}${resultLabel('failed')}${resultLabel('not-run')}</div>
<div class="legend"><span class="legend-label">Since individual acceptance</span><span class="badge change-added">Added</span><span class="badge change-modified">Modified</span><span class="badge change-removed">Removed</span></div>
<p class="help">${options.staticReview ? 'Review each change, then select only the specifications you approve. Copy your approval text and paste it into the agent conversation. This file never updates acceptance.' : options.sessionToken ? 'Accept each specification independently. Acceptance updates only that specification in intentdd.lock.json.' : 'To accept individual specification changes, run npm start and <a href="http://127.0.0.1:8765/lineage">open the local review interface</a> (or use the printed port followed by /lineage).'}</p>
<p class="message" role="status" id="lineage-message"></p>
<div id="scenario-groups">${groupRows(sections)}</div>
</main>
</body>
</html>
`;
}
