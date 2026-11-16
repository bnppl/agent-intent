import { renderDecisionInbox } from './decision-inbox.js';
import { decisionStatus, type DecisionInbox } from '../decisions.js';
import { supportingFeatures, initialiseSupportingNavigation, lineageIds as scenarioLineageIds } from './supports.js';
import { initialiseFractalNavigation } from './fractal.js';
import { initialiseExecutionTabs } from './execution-tabs.js';
import { initialiseStackNavigation } from './stack-navigation.js';
import { logoDataUrl } from './brand.js';
import { editorLink } from '../core/editor.js';
import { requirement, type ProjectBrief } from '../core/brief.js';
import type { EditorOptions } from '../core/editor.js';
import { highlightedSource } from './highlight.js';
import type { TestSource } from './source.js';
import type { Scenario } from '../core/types.js';
import { lineageStyles } from './style.js';
import { definitionParts, definitionText, executionDefinition } from './definition.js';
import type { StoredScenario } from './state.js';
import type { ScenarioExecution } from './evidence.js';
import { groupRows } from './grouping.js';

export interface LineageTest { description: string; tags: readonly string[]; status?: 'passed' | 'failed'; source?: TestSource; logs?: string[] }
export type LineageScenario = Pick<Scenario, 'id' | 'path' | 'name' | 'tags'> & { key?: string; fingerprint?: string; definition?: string };
export interface ReportOptions { decisions?: DecisionInbox; executions?: readonly ScenarioExecution[]; accepted?: readonly StoredScenario[]; sessionToken?: string; revision?: string; runFailed?: boolean; staticReview?: boolean; editor?: EditorOptions; view?: 'specifications' | 'changes' | 'workflow' | 'decisions'; brief?: ProjectBrief; briefOnly?: boolean }

function text(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function projectBrief(brief: ProjectBrief, nested = false): string {
  return `<article class="project-brief" aria-label="Project intent">
<h2>Problem statement</h2>
${brief.problemStatement ? `<p class="problem-statement">${text(brief.problemStatement)}</p>` : '<p>Write a problem statement in <code>intent.md</code>.</p>'}
<h2>High-level requirements</h2>
${nested ? '<p>Browse requirements and their specifications below.</p>' : brief.requirements.length ? `<ul>${brief.requirements.map(requirement => `<li>${text(requirement)}</li>`).join('')}</ul>` : '<p>Add at least one high-level requirement in <code>intent.md</code>.</p>'}
</article>`;
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

function testRow(test: LineageTest, parentIds: Set<string>, editor?: EditorOptions, fractal = false, id = ''): string {
  const shared = [...new Set(test.tags.filter(tag => parentIds.has(tag)))].map(tag => '@' + tag).join(', ');
  const additional = [...new Set(test.tags.filter(tag => !parentIds.has(tag)))].map(tag => '@' + tag).join(', ');
  const code = test.source
    ? `<p class="test-source-location">${sourceLocation(test.source.path, test.source.line, editor)}</p><pre><code>${highlightedSource(test.source.code, test.source.path)}</code></pre>`
    : '<p class="empty">Test code was not captured for this run. Regenerate the report with source files available.</p>';
  if (fractal) return `<li data-unit-spec id="${text(id)}" data-result="${test.status ?? 'passed'}"><details><summary>${chevron}<a data-spec-title href="#spec=${encodeURIComponent(id)}">${text(test.description)}</a>${resultLabel(test.status ?? 'passed')}</summary>${code}${test.logs?.map(log => `<pre><code>${text(log)}</code></pre>`).join('') || '<p class="empty">No unit test logs were recorded.</p>'}</details></li>`;
  return `<li data-result="${test.status ?? 'passed'}" data-lineage="${text(shared)}">${text(test.description)}${resultLabel(test.status ?? 'passed')}${additional ? `<small class="test-tags">${text(additional)}</small>` : ''}<details class="test-code"><summary aria-label="View test code" title="View test code"><span aria-hidden="true">&lt;/&gt;</span></summary>${code}</details></li>`;
}

function stepStatus(status: string): string {
  const result = status === 'PASSED' ? 'passed' : status === 'SKIPPED' ? 'not-run' : 'failed';
  return `<span class="badge result-${result}">${text(status.slice(0, 1) + status.slice(1).toLowerCase())}</span>`;
}

function specificationSource(definition: string, path: string, executions: readonly ScenarioExecution[], support: (step: number) => string = () => '', scenarioId = '', editor?: EditorOptions, fractal = false, concrete?: ScenarioExecution, supportFailed: (step: number) => boolean = () => false): string {
  if (!concrete && executions.some(run => run.exampleLine !== undefined)) {
    const base = scenarioId + '-executions';
    const header = JSON.parse(definition);
    for (const context of header.contexts) { delete context.backgrounds; delete context.steps; }
    delete header.scenario.steps;
    delete header.scenario.examples;
    const description = definitionParts(JSON.stringify(header)).map(part => `<pre class="gherkin-${part.level ?? 'context'}">${highlightedSource(part.text, path)}</pre>`).join('');
    return `<div class="outline-description">${description}</div><div class="execution-tabs" data-execution-tabs><div role="tablist" aria-label="Example executions"><span class="examples-label">Examples:</span>${executions.map((run, index) => {
      const values = Object.entries(run.exampleValues ?? {}).map(([key, value]) => key + '=' + value).join(', ') || run.name;
      const label = `Example line ${run.exampleLine ?? '?'} · ${values} · Attempt ${run.attempt}${run.willBeRetried ? ' · Retried' : ''}`;
      return `<button type="button" role="tab" id="${text(base)}-tab-${index}" aria-label="Example ${index + 1}" title="${text(label)}" aria-controls="${text(base)}-panel-${index}" aria-selected="${index === 0}" tabindex="${index === 0 ? 0 : -1}">${index + 1}</button>`;
    }).join('')}</div>${executions.map((run, index) => {
      const result = run.steps.some(step => !['PASSED', 'SKIPPED'].includes(step.status)) ? 'failed' : run.steps.length && run.steps.every(step => step.status === 'PASSED') ? 'passed' : 'not-run';
      return `<div role="tabpanel" id="${text(base)}-panel-${index}" aria-labelledby="${text(base)}-tab-${index}" tabindex="0"><div class="execution-result">${resultLabel(result)}<span>Example line ${run.exampleLine ?? '?'} · Attempt ${run.attempt}${run.willBeRetried ? ' · Retried' : ''}</span></div>${specificationSource(executionDefinition(definition, run.exampleValues, run.name), path, [run], support, index === 0 ? scenarioId : scenarioId + '-run-' + index, editor, fractal, run, supportFailed)}</div>`;
    }).join('')}</div>`;
  }
  const parts = definitionParts(definition);
  const stepCount = parts.filter(part => part.step).length;
  // Pickle steps follow feature background, rule background, then scenario steps.
  // Keep an incomplete execution from shifting evidence onto a different step.
  const runs = executions.filter(run => run.steps.length === stepCount);
  if (!fractal && !runs.length && !parts.some((part, index) => part.step && support(parts.slice(0, index + 1).filter(item => item.step).length))) return `<pre>${highlightedSource(parts.map(part => part.text).join('\n'), path)}</pre>`;

  let index = 0;
  const rows = parts.map(part => {
    const concreteText = concrete && part.step && runs[0]?.steps[index] ? '  ' + runs[0].steps[index].text + part.text.slice(part.text.indexOf('\n') < 0 ? part.text.length : part.text.indexOf('\n')) : part.text;
    const source = highlightedSource(concreteText, path);
    if (!part.step) return concrete ? '' : `<pre class="gherkin-${part.level ?? 'context'}">${source}</pre>`;
    const stepIndex = index++;
    const total = runs.reduce((count, run) => count + run.steps[stepIndex].logs.length, 0);
    const firstStatus = runs[0]?.steps[stepIndex].status ?? 'SKIPPED';
    const supporting = support(stepIndex + 1);
    const code = `<code class="step-text"${supporting && !fractal ? ` id="${text(scenarioId)}-step-${stepIndex + 1}"` : ''}>${source}</code>`;
    if (!total && !fractal) {
      const status = runs.every(run => run.steps[stepIndex].status === firstStatus) ? stepStatus(firstStatus) : '';
      return `<div class="step-without-evidence">${code}${runs.length ? status : ''}${supporting}</div>`;
    }
    const showRunLabels = !concrete && (runs.length > 1 || runs[0]?.exampleLine !== undefined || runs[0]?.attempt > 1 || runs[0]?.willBeRetried);
    const evidence = runs.map(run => {
      const step = run.steps[stepIndex];
      const label = [run.exampleLine === undefined ? '' : `Example line ${run.exampleLine}`,
        run.attempt > 1 || run.willBeRetried ? `Attempt ${run.attempt}` : '',
        run.willBeRetried ? 'Retried' : ''].filter(Boolean).join(' · ');
      const heading = showRunLabels ? `<h4>${label || 'Execution'} ${stepStatus(step.status)}</h4>` : '';
      const logs = step.logs.length ? step.logs.map(log => `<pre><code>${text(log)}</code></pre>`).join('')
        : '<p class="empty">No evidence captured for this step.</p>';
      return `<div class="step-run">${heading}${step.source ? `<p class="path">${sourceLocation(step.source.path, step.source.line, editor)}</p>` : ''}${logs}</div>`;
    }).join('');
    const failed = supportFailed(stepIndex + 1) || runs.some(run => !run.willBeRetried && !['PASSED', 'SKIPPED'].includes(run.steps[stepIndex].status));
    const status = failed ? resultLabel('failed') : showRunLabels ? '' : stepStatus(firstStatus);
    return `<details class="step-evidence"${fractal ? ` data-result="${failed ? 'failed' : 'not-run'}"` : ''}${fractal ? ` id="${text(scenarioId)}-step-${stepIndex + 1}"` : ''}><summary>${chevron}${fractal ? `<a data-spec-title href="#spec=${encodeURIComponent(scenarioId + '-step-' + (stepIndex + 1))}">${code}</a>` : code}${status}<small>${total} log ${total === 1 ? 'entry' : 'entries'}</small></summary>${evidence}${fractal ? supporting : ''}</details>${fractal ? '' : supporting}`;
  }).join('');
  return `<div class="gherkin-source">${rows}</div>`;
}

export function renderLineage(scenarios: readonly LineageScenario[], tests: readonly LineageTest[], options: ReportOptions = {}): string {
  const fractal = !!options.brief && (!options.view || options.view === 'specifications');
  const supportGraph = supportingFeatures(scenarios);
  const unitLinks = tests.flatMap((test, index) => test.tags.flatMap(tag => {
    const match = /^@?supports:([^:]+):([1-9]\d*)$/.exec(tag);
    if (!match) return [];
    const parents = scenarios.filter(parent => parent.tags.includes('@' + match[1]));
    const parent = parents.length === 1 ? parents[0] : undefined;
    const count = parent?.definition ? definitionParts(parent.definition).filter(part => part.step).length : 0;
    return parent && Number(match[2]) <= count ? [{ test, index, parent: parent.id, step: Number(match[2]) }] : [];
  }));
  // Propagate failure through valid support edges to a fixed point (shared parents included).
  const failedScenarios = new Set(scenarios.filter(scenario => {
    const ids = new Set(scenarioLineageIds(scenario.tags));
    return tests.some(test => test.status === 'failed' && test.tags.some(tag => ids.has(tag)))
      || unitLinks.some(link => link.parent === scenario.id && link.test.status === 'failed')
      || (options.executions ?? []).some(run => run.scenarioId === scenario.id && !run.willBeRetried
        && run.steps.some(step => !['PASSED', 'SKIPPED'].includes(step.status)));
  }).map(scenario => scenario.id));
  const validLinks = supportGraph.links.filter(link => !supportGraph.diagnostics.has(link.child));
  let changed = true;
  while (changed) {
    changed = false;
    for (const link of validLinks) if (failedScenarios.has(link.child) && !failedScenarios.has(link.parent)) {
      failedScenarios.add(link.parent); changed = true;
    }
  }
  const failedStep = (id: string, step: number) => validLinks.some(link => link.parent === id && link.step === step && failedScenarios.has(link.child))
    || unitLinks.some(link => link.parent === id && link.step === step && link.test.status === 'failed');
  const supportChildren = new Set(supportGraph.links.filter(link => !supportGraph.diagnostics.has(link.child)).map(link => link.child));
  const supportId = (id: string, step: number) => `support-${encodeURIComponent(id)}-${step}`;
  const supportLink = (id: string, step: number) => fractal ? `<!--subspec:${encodeURIComponent(id)}:${step}-->` : (!options.sessionToken || !options.view || options.view === 'specifications') && supportGraph.links.some(link => link.parent === id && link.step === step) ? `<a class="support-link" data-support-link href="#${text(supportId(id, step))}"><span>Components</span>${chevron}</a>` : '';
  const featureTitle = (path: string) => {
    const definition = scenarios.find(scenario => scenario.path === path)?.definition;
    const title = definition ? (JSON.parse(definition) as { contexts?: { name?: string }[] }).contexts?.[0]?.name : undefined;
    return title ? `${text(title)} <small>${text(path)}</small>` : text(path);
  };
  function componentGroups(links: typeof supportGraph.links): string {
    const groups = new Map<string, Map<string, typeof links>>();
    for (const link of links) {
      const child = scenarios.find(scenario => scenario.id === link.child)!;
      const tag = child.tags.find(tag => tag.startsWith('@component:'));
      const name = tag?.slice('@component:'.length).replaceAll('-', ' ').trim() || 'Other components';
      if (!groups.has(name)) groups.set(name, new Map());
      const features = groups.get(name)!;
      features.set(child.path, [...features.get(child.path) ?? [], link]);
    }
    return [...groups].map(([name, features]) => `<div class="support-component" data-component="${text(name)}"><h3 class="component-name">${text(name)}</h3>${[...features].map(([path, featureLinks]) => `<div class="support-feature" data-component-name="${text(name)}"><h3><button type="button" data-drill-feature>${featureTitle(path)}</button></h3>${featureLinks.map(link => `<div data-support-child="${text(link.child)}"><a href="#${text(link.child)}">${text(scenarios.find(scenario => scenario.id === link.child)!.name)}</a></div>`).join('')}</div>`).join('')}</div>`).join('');
  }
  const stack = !!options.brief && (!options.view || options.view === 'specifications');
  const back = '<span class="stack-back">Back · </span>';
  const accepted = new Map((options.accepted ?? []).map(scenario => [scenario.key, scenario]));
  const keys = new Set(scenarios.map(scenario => scenario.key ?? scenario.id));
  const removed = (options.accepted ?? []).filter(scenario => !keys.has(scenario.key));
  const sections = [...scenarios, ...removed].map(scenario => {
    const key = scenario.key ?? scenario.id, previous = accepted.get(key);
    const change = removed.includes(scenario as StoredScenario) ? 'removed' : !previous ? 'added'
      : previous.fingerprint === scenario.fingerprint ? 'unchanged' : 'modified';
    const ids = new Set(scenarioLineageIds(scenario.tags));
    const related = change === 'removed' ? [] : tests.filter(test => test.tags.some(tag => ids.has(tag)));
    const typedLayer = scenario.tags.some(tag => ['@api', '@frontend', '@e2e'].includes(tag));
    const lineageIds = [...ids].filter(id => related.some(test => test.tags.includes(id)));
    const executions = change === 'removed' ? [] : (options.executions ?? []).filter(run => run.scenarioId === scenario.id);
    const steps = executions.filter(run => !run.willBeRetried).flatMap(run => run.steps);
    const specification = scenario.definition ? `<div class="gherkin-specification"><h3>Gherkin specification</h3>${specificationSource(scenario.definition, scenario.path, executions, step => supportLink(scenario.id, step), scenario.id, options.editor, fractal, undefined, step => failedStep(scenario.id, step))}</div>` : '';
    const failed = failedScenarios.has(scenario.id) || related.some(test => test.status === 'failed')
      || steps.some(step => !['PASSED', 'SKIPPED'].includes(step.status));
    const result = failed ? 'failed' : related.length || steps.some(step => step.status === 'PASSED') ? 'passed' : 'not-run';
    const changeLabel = change === 'unchanged' ? '' : `<span class="badge change-${change}">${change[0].toUpperCase() + change.slice(1)}</span>`;
    const review = change === 'unchanged' || !scenario.definition ? '' : `<details class="spec-change"><summary>${chevron}Review specification change</summary><div class="comparison"><div><h3>Previously accepted</h3>${previous ? `<pre>${highlightedSource(definitionText(previous.definition), previous.path)}</pre>` : '<p>Not previously accepted.</p>'}</div><div><h3>Current specification</h3>${change === 'removed' ? '<p>Specification removed.</p>' : `<pre>${highlightedSource(definitionText(scenario.definition), scenario.path)}</pre>`}</div></div></details>`;
    const action = options.staticReview ? '' : change === 'unchanged'
      ? '<button type="button" disabled>Accepted</button>'
      : `<button type="button" data-accept="${text(key)}" data-previous="${previous?.fingerprint ?? ''}" aria-label="Accept ${text(scenario.name)}${change === 'removed' ? ' removal' : ''}"${options.sessionToken ? '' : ' disabled'}>Accept${change === 'removed' ? ' removal' : ''}</button>`;
    const selection = options.staticReview && change !== 'unchanged'
      ? `<div class="review-actions"><label class="approval-choice"><input type="checkbox" data-review-key="${text(key)}"> Select approval of this specification ${change === 'removed' ? 'removal' : 'change'}</label></div>` : '';
    return { id: scenario.id, name: scenario.name, result, change, requirementId: scenario.tags.filter(tag => /^@req-\d+$/i.test(tag)).at(-1)?.slice(1).toLowerCase(), html: `<section id="${text(scenario.id + (change === 'removed' ? '-removed' : ''))}" data-result="${result}" data-change="${change}">
<details${stack ? ' class="specification-level"' : ''}>
<summary>${stack ? back : ''}${chevron}<h2>${fractal ? `<a data-spec-title href="#spec=${encodeURIComponent(scenario.id)}">${text(scenario.name)}</a>` : text(scenario.name)}</h2>${resultLabel(result)}${scenario.tags.filter(tag => ['@api', '@frontend', '@e2e'].includes(tag)).map(tag => `<span class="badge layer-badge">${tag === '@api' ? 'API' : tag === '@e2e' ? 'E2E' : 'Frontend'}</span>`).join('')}${changeLabel}${action}</summary>
<p class="path">${sourceLocation(scenario.path, Number(scenario.id.slice(scenario.id.lastIndexOf(':') + 1)), options.editor)}</p>
${(supportGraph.diagnostics.get(scenario.id) ?? []).map(message => `<p role="alert" class="support-diagnostic">${text(message)}</p>`).join('')}
${specification}
${lineageIds.length ? `<p class="scenario-lineage">Lineage IDs: ${text(lineageIds.map(id => '@' + id).join(', '))}</p>` : ''}
<h3 class="supporting-tests">Supporting ${typedLayer ? 'tests' : 'unit tests'}</h3>
${related.length ? `<ul>${related.filter(test => !fractal || !unitLinks.some(link => link.test === test)).map((test, index) => testRow(test, ids, options.editor, fractal, scenario.id + '-unit-' + index)).join('\n')}</ul>`
      : `<p class="empty">No associated ${typedLayer ? 'tests' : 'unit tests'} ran with a matching lineage ID.</p>`}
${review}
${selection}
</details>
</section>` };
  });
  const renderedChildren = new Set<string>();
  const renderedUnits = new Set<number>();
  const renderedComponents = new Set<string>();
  function nested(html: string): string {
    return html.replace(/<!--subspec:([^:]*):(\d+)-->/g, (_, encoded: string, step: string) => {
      const links = supportGraph.links.filter(link => link.parent === decodeURIComponent(encoded) && link.step === Number(step) && !supportGraph.diagnostics.has(link.child));
      const units = unitLinks.filter(link => link.parent === decodeURIComponent(encoded) && link.step === Number(step));
      if (!links.length && !units.length) return '';
      const groups = new Map<string, typeof links>();
      for (const link of links) {
        const child = scenarios.find(item => item.id === link.child)!;
        const component = child.tags.find(tag => tag.startsWith('@component:'))?.slice(11).replaceAll('-', ' ') || 'Other components';
        groups.set(component, [...groups.get(component) ?? [], link]);
      }
      const unitGroups = new Map<string, typeof units>();
      for (const unit of units) {
        const name = unit.test.tags.find(tag => /^@?component:/.test(tag))?.replace(/^@?component:/, '').replaceAll('-', ' ') || 'Unit specifications';
        unitGroups.set(name, [...unitGroups.get(name) ?? [], unit]);
      }
      const names = [...new Set([...groups.keys(), ...unitGroups.keys()])];
      const failure = failedStep(decodeURIComponent(encoded), Number(step));
      return `<div class="sub-specifications"${failure ? ' data-support-failed' : ''}><h3>Sub specifications</h3>${names.map(component => {
        const componentId = decodeURIComponent(encoded) + '-step-' + step + '-component-' + encodeURIComponent(component);
        if (renderedComponents.has(componentId)) {
          const children = (groups.get(component) ?? []).map(link => `<p><a data-spec-title href="#spec=${encodeURIComponent(link.child)}">${text(sections.find(row => row.id === link.child)!.name)}</a></p>`).join('');
          const leaves = (unitGroups.get(component) ?? []).map(unit => `<p><a data-spec-title href="#spec=unit-spec-${unit.index}">${text(unit.test.description)}</a></p>`).join('');
          return `<div class="support-component"><h3><a data-spec-title href="#spec=${encodeURIComponent(componentId)}">${text(component)}</a></h3>${children}${leaves}</div>`;
        }
        renderedComponents.add(componentId);
        const children = (groups.get(component) ?? []).map(link => {
          if (renderedChildren.has(link.child)) return `<p><a data-spec-title href="#spec=${encodeURIComponent(link.child)}">${text(sections.find(row => row.id === link.child)!.name)}</a></p>`;
          renderedChildren.add(link.child); return nested(sections.find(row => row.id === link.child)!.html);
        }).join('');
        const leaves = (unitGroups.get(component) ?? []).map(unit => {
          const id = 'unit-spec-' + unit.index;
          if (renderedUnits.has(unit.index)) return `<li><a data-spec-title href="#spec=${id}">${text(unit.test.description)}</a></li>`;
          renderedUnits.add(unit.index); return testRow(unit.test, new Set(), options.editor, true, id);
        }).join('');
        return `<div class="support-component" data-component="${text(component)}" data-component-spec data-result="${(groups.get(component) ?? []).some(link => failedScenarios.has(link.child)) || (unitGroups.get(component) ?? []).some(unit => unit.test.status === 'failed') ? 'failed' : 'not-run'}" id="${text(componentId)}"><h3><a data-spec-title href="#spec=${encodeURIComponent(componentId)}">${text(component)}</a>${(groups.get(component) ?? []).some(link => failedScenarios.has(link.child)) || (unitGroups.get(component) ?? []).some(unit => unit.test.status === 'failed') ? resultLabel('failed') : ''}</h3>${children}${leaves ? `<ul>${leaves}</ul>` : ''}</div>`;
      }).join('')}</div>`;
    });
  }
  const rootSections = sections.filter(section => !supportChildren.has(section.id));
  function requirementGroups(): string {
    const requirements = options.brief!.requirements.map(requirement);
    const known = new Set(requirements.map(item => item.id).filter(Boolean));
    const group = (id: string, title: string, rows: typeof sections) => `<article id="${text(id)}" data-requirement="${text(id)}" data-result="${rows.some(row => row.result === 'failed') ? 'failed' : 'not-run'}" class="requirement-group"><details class="requirement-level"><summary>${back}${chevron}<h2>${fractal ? `<a data-spec-title href="#spec=${encodeURIComponent(id)}">${text(title)}</a>` : text(title)}</h2></summary><div data-requirement-rows data-stack-rows>${options.briefOnly ? '<p>No tests have run.</p>' : ''}${rows.length ? rows.map(row => fractal ? nested(row.html) : row.html).join('\n') : '<p class="empty">No specifications linked.</p>'}</div></details></article>`;
    const linked = requirements.map((item, index) => group(item.id ?? `legacy-${index}`, `${item.id ? item.id.toUpperCase() + ' · ' : ''}${item.text}`, item.id ? rootSections.filter(row => row.requirementId === item.id) : [])).join('\n');
    const unlinked = rootSections.filter(row => !row.requirementId || !known.has(row.requirementId));
    return linked + (unlinked.length ? group('unlinked', 'Specifications without a requirement link', unlinked.map(row => ({ ...row, html: (row.requirementId ? `<p class="empty">Unknown requirement: ${text(row.requirementId.toUpperCase())}</p>` : '') + row.html }))) : '');
  }
  function reportOutline(): string {
    const requirements = options.brief!.requirements.map(requirement);
    const known = new Set(requirements.map(item => item.id).filter(Boolean));
    const rowsFor = (rows: typeof sections) => rows.map(row => {
      const components = supportGraph.links.filter(link => link.parent === row.id);
      const steps = [...new Set(components.map(link => link.step))];
      return `<div class="outline-scenario"><button type="button" data-result="${row.result}" data-outline-scenario="${text(row.id)}">${text(row.name)}</button>${steps.map(step => `<button type="button" class="outline-components" data-outline-parent="${text(row.id)}" data-outline-components="${text(supportId(row.id, step))}">Components${steps.length > 1 ? ` · Step ${step}` : ''}<span aria-hidden="true">${new Set(components.filter(link => link.step === step).map(link => scenarios.find(item => item.id === link.child)!.path)).size}</span></button>`).join('')}</div>`;
    }).join('');
    const groups = requirements.map((item, index) => `<div class="outline-group"><button type="button" data-result="${rootSections.some(row => row.requirementId === item.id && row.result === 'failed') ? 'failed' : 'not-run'}" data-outline-requirement="${text(item.id ?? `legacy-${index}`)}">${item.id ? `<span class="outline-id">${text(item.id.toUpperCase())}</span>` : ''}<span>${text(item.text)}</span></button>${rowsFor(item.id ? rootSections.filter(row => row.requirementId === item.id) : [])}</div>`).join('');
    const unlinked = rootSections.filter(row => !row.requirementId || !known.has(row.requirementId));
    return `<aside class="report-outline" aria-label="Report outline"><div class="outline-heading"><span class="report-brand">Agent Intent</span><button type="button" data-outline-toggle aria-expanded="false" aria-controls="report-outline">Browse report${chevron}</button></div><nav id="report-outline" aria-label="Report sections"><button type="button" data-outline-home aria-current="page">Project intent</button>${groups}${unlinked.length ? `<div class="outline-group"><button type="button" data-outline-requirement="unlinked">Unlinked specifications</button>${rowsFor(unlinked)}</div>` : ''}</nav></aside>`;
  }
  const view = options.sessionToken ? options.view ?? 'specifications' : 'specifications';
  const pending = sections.filter(section => section.change !== 'unchanged');
  const navigation = options.sessionToken ? `<nav class="report-nav" aria-label="Report views">${[
    ['specifications', 'Specifications'], ['changes', 'Changes'], ['workflow', 'Workflow'], ['decisions', 'Decisions'],
  ].filter(([key]) => key !== 'changes' || !options.briefOnly).map(([key, label]) => `<a href="/?view=${key}"${view === key ? ' aria-current="page"' : ''}>${label}${key === 'changes' ? ` <span id="pending-count">${pending.length}</span>` : key === 'decisions' ? ` <span>${options.decisions?.items.filter(item => decisionStatus(item) === 'unresolved').length ?? 0}</span>` : ''}</a>`).join('')}</nav>` : '';
  const workflow = `<article class="workflow">
<h2>From executable examples to accepted specifications</h2>
<p>Each Gherkin scenario describes a specification. Shared lineage IDs connect it to the unit tests that support it.</p>
<div class="workflow-step"><h3>1. Run the tests</h3><p>Generate a fresh report with the current specifications and recorded test outcomes.</p><pre>npm run test:lineage</pre></div>
<div class="workflow-step"><h3>2. Review each change</h3><p>Open Changes to compare accepted and current Gherkin. Expand a scenario to inspect its supporting tests and captured test code.</p><p>Accept updates only that specification in <code>agent-intent.lock.json</code>. Test results and specification acceptance are separate.</p></div>
<div class="workflow-step"><h3>3. Verify the report</h3><p>Check that source matches the report, tests passed and every specification matches the accepted lock.</p><pre>npm run intent -- verify</pre></div>
<div class="workflow-step"><h3>Review from your phone</h3><p>Export an HTML review and a text companion using a fresh output prefix. Select individual changes and paste the complete approval blocks into your agent conversation with an instruction to apply them.</p><pre>npm run intent -- review --output reviews/mobile-review</pre><p>Selection and copying never accept changes. Specification acceptance does not approve implementation changes or authorise commits.</p></div>
</article>`;
  const runStatus = options.runFailed || failedScenarios.size || tests.some(test => test.status === 'failed') ? '<p data-run-status class="message error" role="alert">Test run failed for the overall report. Individual specification results are shown separately.</p>' : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Agent Intent report</title>
${options.sessionToken ? `<meta name="agent-intent-token" content="${text(options.sessionToken)}"><meta name="decision-revision" content="${text(options.decisions?.revision ?? '')}"><meta name="lineage-revision" content="${text(options.revision ?? '')}"><link rel="stylesheet" href="/lineage.css"><script src="/lineage.js" defer></script>` : `<style>${lineageStyles}</style>`}
</head>
<body>
${stack ? '' : `<header>
<img class="brand-logo" src="${logoDataUrl}" alt="Agent Intent: a secret agent peeking out of a tent" width="216" height="108">
<h1>Agent Intent report</h1>
<p>${options.briefOnly ? 'Project intent before implementation.' : 'Specifications and the tests that support them.'}</p>
${options.sessionToken ? '<a class="refresh-report" href="">Refresh report</a>' : ''}
</header>`}
${stack ? navigation : ''}
<main${stack ? ' data-report-stack data-fractal-report' : ''}>
${stack ? `${reportOutline()}<div class="workspace-stage"><div class="stack-navigation"><button type="button" data-stack-back disabled aria-label="Go back one level"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m12 5-7 7 7 7M5 12h14"/></svg>Back</button><nav aria-label="Breadcrumb"><ol data-stack-crumbs><li><span data-stack-depth="0" aria-current="page">Project intent</span></li></ol></nav></div>${runStatus}<div data-stack-content><div class="stack-overview"><article class="project-brief" aria-label="Project intent"><h2>Problem statement</h2>${options.brief!.problemStatement ? `<p class="problem-statement">${text(options.brief!.problemStatement)}</p>` : '<p>Write a problem statement in <code>intent.md</code>.</p>'}<h2>High-level requirements</h2></article></div><div id="scenario-groups">${options.brief!.requirements.length ? requirementGroups() : '<p>Add at least one high-level requirement in <code>intent.md</code>.</p>'}</div><p class="message" role="status" id="lineage-message"></p></div>` : `
${navigation}
${runStatus}
${view === 'specifications' && options.brief ? projectBrief(options.brief, !options.briefOnly) : ''}
${view === 'decisions' ? renderDecisionInbox(options.decisions ?? { version: 1, items: [], revision: '' }) : view === 'workflow' ? workflow : options.briefOnly ? '<p>No tests have run. Edit <code>intent.md</code> and refresh to review your changes.</p>' : `
${options.sessionToken ? `<div class="view-heading"><h2>${view === 'changes' ? 'Specification changes' : 'Specifications and supporting tests'}</h2><p>${view === 'changes' ? 'Compare each proposed definition with its accepted baseline.' : `${scenarios.length} specifications · ${tests.length} recorded tests`}</p></div>` : ''}
<p>Select a scenario to read its Gherkin and associated unit-test descriptions. Select it again to collapse the list.</p>
<div class="legend"><span class="legend-label">Test results</span>${resultLabel('passed')}${resultLabel('failed')}${resultLabel('not-run')}</div>
<div class="legend"><span class="legend-label">Since individual acceptance</span><span class="badge change-added">Added</span><span class="badge change-modified">Modified</span><span class="badge change-removed">Removed</span></div>
<p class="help">${options.staticReview ? 'Review each change, then select only the specifications you approve. Copy your approval text and paste it into the agent conversation. This file never updates acceptance.' : options.sessionToken ? 'Accept each specification independently. Acceptance updates only that specification in agent-intent.lock.json.' : 'To accept individual specification changes, run npx agent-intent start and <a href="http://127.0.0.1:8765/lineage">open the local review interface</a> (or use the printed port followed by /lineage).'}</p>
<p class="message" role="status" id="lineage-message"></p>
<div id="scenario-groups"${view === 'changes' ? ' data-changes-only' : ''}>${view === 'specifications' && options.brief ? requirementGroups() : groupRows(view === 'changes' ? pending : rootSections)}</div>
${view === 'changes' ? `<p id="changes-empty" class="review-empty"${pending.length ? ' hidden' : ''}>No specification changes awaiting acceptance. <a href="/?view=specifications">Browse all specifications</a>.</p>` : ''}
`}
`}
${!fractal && view === 'specifications' && supportGraph.links.length ? `<div data-support-library><h2>Component specifications</h2>${sections.filter((_, index) => supportChildren.has(scenarios[index]?.id)).map(row => row.html).join('')}</div>${[...new Set(supportGraph.links.map(link => supportId(link.parent, link.step)))].map(id => {
  const links = supportGraph.links.filter(link => supportId(link.parent, link.step) === id);
  const parent = scenarios.find(scenario => scenario.id === links[0].parent)!;
  return `<article id="${text(id)}" data-support-view data-support-parent="${text(parent.id)}" data-support-step="${links[0].step}"><a data-support-back href="#${text(parent.id)}-step-${links[0].step}">${chevron}Back to originating step</a><h2>Components</h2><p>${text(parent.name)} · Step ${links[0].step}</p>${componentGroups(links)}</article>`;
}).join('')}` : ''}
${stack ? '</div>' : ''}
</main>
${!fractal && !options.sessionToken && supportGraph.links.length ? `<script>(${initialiseSupportingNavigation.toString()})();</script>` : ''}
${!options.sessionToken && options.executions?.some(run => run.exampleLine !== undefined) ? `<script>(() => { const __name = value => value; (${initialiseExecutionTabs.toString()})(); })();</script>` : ''}
${stack && !options.sessionToken ? `<script>(() => { const __name = value => value; (${initialiseFractalNavigation.toString()})(); })();</script>` : ''}
</body>
</html>
`;
}
