import { renderLineage, type LineageScenario } from '../../src/lineage/report.js';
import { assert, logEvidence } from './evidence.js';
export class SupportingFeatureDriver {
  scenarios: LineageScenario[] = [];
  html = '';
  definition = JSON.stringify({ contexts: [], scenario: { keyword: 'Scenario', name: 'Choose', steps: [{ keyword: 'Given ', text: 'toys exist' }, { keyword: 'When ', text: 'I choose' }] } });
  scenario(id: string, tags: string[], path = 'features/root.feature'): LineageScenario { return { id, name: id, path, tags, definition: this.definition }; }
  parent(): void {
    this.scenarios = [this.scenario('parent', ['@choose', '@e2e'])];
    logEvidence('Report fixture', 'Unexecuted E2E @choose has two Gherkin steps.');
  }
  children(): void {
    this.scenarios.push(this.scenario('api', ['@list-api', '@api', '@supports:choose:1'], 'features/api.feature'), this.scenario('frontend', ['@list-ui', '@frontend', '@supports:choose:1'], 'features/ui.feature'));
    logEvidence('Supporting feature fixtures', 'API and Frontend support @choose step 1, with independent lineage IDs.');
  }
  render(workspace = false): void {
    this.html = renderLineage(this.scenarios, [{ description: 'API works', tags: ['list-api'], status: 'passed', source: { path: 'api.test.ts', line: 1, code: 'assert.ok(response)' } }], { ...(workspace ? { brief: { problemStatement: 'Review component evidence', requirements: ['Inspect components'] } } : {}), executions: [{ scenarioId: 'api', name: 'api', attempt: 1, willBeRetried: false, steps: [{ text: 'toys exist', status: 'PASSED', logs: ['GET /toys → 200'] }, { text: 'I choose', status: 'PASSED', logs: [] }] }] });
    logEvidence('Render report', `Rendered ${this.scenarios.length} scenarios with independent API test and captured HTTP log.`);
  }
  namedComponents(): void {
    this.children(); this.scenarios[1].tags.push('@component:Game-API'); this.scenarios[2].tags.push('@component:Web-App');
    logEvidence('Named components', 'API feature belongs to Game API; frontend feature belongs to Web App.');
  }
  componentGroups(): void {
    assert.ok(this.html.includes('data-component="Game API"')); assert.ok(this.html.includes('data-component="Web App"'));
    logEvidence('Component grouping', 'Both named component groups contain their independent supporting features.');
  }
  featureLevel(): void { this.render(true); assert.match(this.html, /data-drill-feature/); logEvidence('Component feature levels', 'Feature headings expose navigation into each component.'); }
  deeperLevels(): void { assert.match(this.html, /step-evidence/); assert.match(this.html, /GET \/toys → 200/); logEvidence('Further levels', 'Scenario details retain captured step evidence for progressive navigation.'); }
  navigation(): void { assert.ok(this.html.includes('data-stack-back'), 'workspace has shared Back control'); assert.match(this.html, /initialiseFractalNavigation/); logEvidence('Navigation contract', 'Shared navigation retains feature, scenario and step history; executable navigation tests exercise Back at each level.'); }
  view(): void {
    assert.match(this.html, /data-support-link href="#support-parent-1"/);
    assert.match(this.html, /<article id="support-parent-1" data-support-view/);
    assert.match(this.html, /class="badge layer-badge">API/);
    assert.match(this.html, /class="badge layer-badge">Frontend/);
    assert.match(this.html, /id="api" data-result="passed"/);
    assert.match(this.html, /id="frontend" data-result="not-run"/);
  }
  evidence(): void { assert.match(this.html, /api.test.ts/); assert.match(this.html, /GET \/toys → 200/); }
  back(): void { assert.match(this.html, /data-support-back href="#parent-step-1"/); }
  independent(): void { assert.match(this.html, /id="parent" data-result="not-run"/); }
  invalid(): void {
    this.scenarios = [this.scenario('one', ['@same', '@one', '@supports:two:1']), this.scenario('two', ['@same', '@two', '@supports:one:1']), this.scenario('missing', ['@supports:absent:1']), this.scenario('ambiguous', ['@supports:same:1']), this.scenario('range', ['@supports:one:99'])];
    logEvidence('Invalid relationship fixtures', 'Missing target absent, ambiguous same, step 99, and one/two cycle.');
  }
  diagnostics(): void { for (const message of ['Missing supporting target', 'Ambiguous supporting target', 'Step out of range', 'Cyclic supporting relationship']) assert.ok(this.html.includes(message), message); }
  visible(): void { assert.doesNotMatch(this.html, /<div data-support-library>/); for (const scenario of this.scenarios) assert.ok(this.html.includes(`id="${scenario.id}" data-result`)); }
}
