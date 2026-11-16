import { it } from 'node:test';
import assert from 'node:assert/strict';
import { renderLineage } from '../src/lineage/report.js';
const definition = JSON.stringify({ contexts: [], scenario: { keyword: 'Scenario', name: 'Choose toys', steps: [{ keyword: 'Given ', text: 'toys exist' }] } });
const scenarios = [
  { id: 'journey:1', path: 'journey.feature', name: 'Choose toys', tags: ['@journey', '@req-001'], definition },
  { id: 'api:1', path: 'api.feature', name: 'List toys', tags: ['@api-list', '@supports:journey:1', '@component:API'], definition },
  { id: 'store:1', path: 'store.feature', name: 'Read catalogue', tags: ['@store', '@supports:api-list:1', '@component:Storage'], definition },
];
export function fractalFixture() {
  return renderLineage(scenarios, [{ description: 'Given a catalogue › it returns available toys', tags: ['store'], status: 'passed', logs: ['Expected 2 toys; actual 2'], source: { path: 'catalogue.test.ts', line: 8, code: "it('returns available toys', () => assert.equal(toys.length, 2))" } }], {
    brief: { problemStatement: 'Build a fort', requirements: ['**REQ-001** Choose building toys', '**REQ-002** Save a fort'] },
    editor: { root: '/project', urlTemplate: 'vscode://file{path}:{line}:{column}' },
    executions: [{ scenarioId: 'journey:1', name: 'Choose toys', attempt: 1, willBeRetried: false, steps: [{ text: 'Given toys exist', status: 'PASSED', logs: ['Loaded toys'], source: { path: 'steps/toys.ts', line: 17 } }] }],
  });
}
it('Given nested executable specs, when rendered, then sub specs stay under the owning step', { tags: ['fractal-report'] }, () => {
  const html = fractalFixture();
  assert.match(html, /data-fractal-report/);
  assert.match(html, /data-spec-title/);
  assert.match(html, /data-component="API"[^]*data-component="Storage"/);
  assert.match(html, /Expected 2 toys; actual 2/);
  assert.match(html, /data-unit-spec/);
  assert.equal((html.match(/id="store:1" data-result=/g) ?? []).length, 1);
});
it('Given source evidence, when a step is expanded, then its glue line is linked', { tags: ['fractal-report-source'] }, () => {
  assert.match(fractalFixture(), /vscode:\/\/file\/project\/steps\/toys.ts:17:1/);
});

it('Given a recursive report, when chevrons and titles are used, then expansion and navigation stay separate', { tags: ['fractal-report'] }, async () => {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(5000);
    page.on('pageerror', error => { throw error; });
    await page.route('http://report.test/**', route => route.fulfill({ contentType: 'text/html', body: fractalFixture() }));
    await page.goto('http://report.test/');
    const requirement = page.locator('[data-requirement="req-001"] > details');
    await requirement.locator(':scope > summary > svg').click();
    assert.equal(await requirement.getAttribute('open'), '');
    assert.equal(await page.locator('[data-requirement="req-002"]').isVisible(), true);
    const journey = page.locator('section[id="journey:1"] > details');
    await journey.locator(':scope > summary > svg').click();
    const step = journey.locator(':scope > .gherkin-specification > .gherkin-source > .step-evidence');
    assert.equal(await step.getAttribute('open'), null);
    assert.equal(await page.getByText('Loaded toys', { exact: true }).isVisible(), false);
    await step.locator(':scope > summary > svg').click();
    assert.equal(await page.getByText('Loaded toys', { exact: true }).isVisible(), true);
    const api = page.locator('section[id="api:1"] > details');
    assert.equal(await api.getAttribute('open'), null);
    await api.locator(':scope > summary [data-spec-title]').click();
    await page.waitForFunction(() => document.querySelector('.focused-specification > section')?.id === 'api:1');
    assert.equal(await page.locator('[data-stack-content]').isVisible(), false);
    assert.equal(await api.getAttribute('open'), '');
    await page.getByRole('button', { name: 'Go back one level' }).click();
    await page.waitForFunction(() => !document.querySelector('[data-stack-content]')?.hasAttribute('hidden'));
    assert.equal(await step.getAttribute('open'), '');
    assert.equal(await api.getAttribute('open'), null);
    await api.locator(':scope > summary > svg').click();
    await api.locator('.step-evidence > summary > svg').first().click();
    const storage = page.locator('section[id="store:1"] > details');
    await storage.locator(':scope > summary > svg').click();
    const unit = storage.locator('[data-unit-spec] > details');
    await unit.locator('summary > svg').click();
    assert.equal(await page.getByText('Expected 2 toys; actual 2', { exact: true }).isVisible(), true);
    await unit.locator('summary > [data-spec-title]').click();
    await page.waitForFunction(() => !!document.querySelector('.focused-specification > [data-unit-spec]'));
    assert.equal(await page.locator('.focused-specification > [data-unit-spec] pre').count(), 2);
  } finally { await browser.close(); }
});

it('Given BDD unit tests with diagnostics, when lineage runs, then logs remain attributed to their own tests', { tags: ['fractal-report'] }, async () => {
  const { LineageDriver } = await import('../features/support/lineage-driver.js');
  const { reportModel } = await import('../src/lineage/state.js');
  const driver = new LineageDriver();
  try {
    driver.scenario('units');
    driver.write('example.test.mjs', `import { describe, it } from 'node:test';
      describe('Given available toys', () => {
        it('then returns the catalogue', { tags: ['units'] }, t => t.diagnostic('expected 2, actual 2'));
        it('then retains identifiers', { tags: ['units'] }, t => t.diagnostic('expected stable ids, actual stable ids'));
      });`);
    driver.run();
    const tests = reportModel(driver.root).snapshot.tests;
    assert.deepEqual(tests.map(test => test.logs), [['expected 2, actual 2'], ['expected stable ids, actual stable ids']]);
    assert.ok(tests.every(test => test.source?.code.includes('it(')));
  } finally { driver.close(); }
});

it('Given a unit spec supporting one step, when rendered, then it occurs under that step instead of at the root', { tags: ['fractal-report'] }, () => {
  const html = renderLineage(scenarios, [{ description: 'Given storage › then reads toys', tags: ['supports:store:1', 'component:Storage'], status: 'passed', logs: ['Read 2 toys'] }], { brief: { problemStatement: 'Build forts', requirements: ['**REQ-001** Choose toys'] } });
  assert.match(html, /id="store:1"[^]*class="step-evidence"[^]*data-component="Storage"[^]*data-unit-spec id="unit-spec-0"/);
  assert.equal((html.match(/id="unit-spec-0"/g) ?? []).length, 1);
  assert.match(html, /Read 2 toys/);
});

it('Given a focused deep link on mobile, when Back is used, then the project and its browse controls remain usable', { tags: ['fractal-report'] }, async () => {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.route('http://report.test/**', route => route.fulfill({ contentType: 'text/html', body: fractalFixture() }));
    await page.goto('http://report.test/#spec=store%3A1');
    assert.equal(await page.locator('.focused-specification > section').getAttribute('id'), 'store:1');
    await page.getByRole('button', { name: 'Go back one level' }).click();
    await page.locator('[data-stack-content]').waitFor({ state: 'visible' });
    const browse = page.getByRole('button', { name: 'Browse report' });
    await browse.click();
    assert.equal(await browse.getAttribute('aria-expanded'), 'true');
    assert.equal(await page.locator('#report-outline').isVisible(), true);
  } finally { await browser.close(); }
});

it('Given a scrolling focused report, then its outline and detail stage occupy separate regions', { tags: ['fractal-report-layout'] }, async () => {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    await page.route('http://report.test/**', route => route.fulfill({ contentType: 'text/html', body: fractalFixture() }));
    for (const width of [1440, 1100, 900, 390]) {
      await page.setViewportSize({ width, height: 700 });
      await page.goto('http://report.test/#spec=journey%3A1');
      if (width <= 900) await page.getByRole('button', { name: 'Browse report' }).click();
      await page.locator('.focused-specification > section > details > .gherkin-specification > .gherkin-source > .step-evidence > summary').click();
      for (const scroll of [0, 120, 300]) {
        await page.evaluate(y => window.scrollTo(0, y), scroll);
        const geometry = await page.evaluate(() => {
          const outline = document.querySelector('.report-outline')!.getBoundingClientRect();
          const stage = document.querySelector('.workspace-stage')!.getBoundingClientRect();
          const bar = document.querySelector('.stack-navigation')!.getBoundingClientRect();
          const contained = [...document.querySelectorAll('.stack-navigation li a')].every(link => {
            const box = link.getBoundingClientRect();
            return !box.height || (box.top >= bar.top && box.bottom <= bar.bottom);
          });
          return { contained, separated: outline.right <= stage.left || outline.bottom <= stage.top, overflow: document.documentElement.scrollWidth > innerWidth };
        });
        assert.equal(geometry.separated, true, `outline and report overlap at width ${width}, scroll ${scroll}`);
        assert.equal(geometry.contained, true, `breadcrumbs overflow their bar at width ${width}`);
        assert.equal(geometry.overflow, false, `horizontal overflow at width ${width}`);
      }
    }
  } finally { await browser.close(); }
});

it('Given a copied abstraction link, when opened and reloaded, then that level becomes the report root', { tags: ['abstraction-deep-links'] }, async () => {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    await page.route('http://report.test/**', route => route.fulfill({ contentType: 'text/html', body: fractalFixture() }));
    for (const id of ['req-001', 'journey:1', 'journey:1-step-1', 'journey:1-step-1-component-API', 'store:1', 'store:1-unit-0']) {
      await page.goto('http://report.test/#spec=' + encodeURIComponent(id));
      for (const reload of [false, true]) {
        if (reload) await page.reload();
        assert.equal(await page.locator('.focused-specification > *').count(), 1, `missing focused level ${id}`);
        assert.equal(await page.locator('.focused-specification > *').getAttribute('id'), id, `focus ${id}, reload=${reload}`);
        assert.equal(await page.locator('[data-stack-content]').isVisible(), false);
        assert.equal(await page.locator('.stack-navigation [aria-current="page"]').count(), 1);
      }
    }
  } finally { await browser.close(); }
});

it('keeps acceptance inline with the scenario headline', { tags: ['inline-spec-acceptance'] }, async () => {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.setContent(fractalFixture());
    const requirement = page.locator('[data-requirement="req-001"] > details');
    await requirement.evaluate(element => element.setAttribute('open', ''));
    const scenario = page.locator('section[id="journey:1"] > details');
    await scenario.evaluate(element => element.setAttribute('open', ''));
    const button = scenario.locator(':scope > summary button');
    assert.equal(await button.count(), 1);
    const headlineBox = await scenario.locator(':scope > summary h2').boundingBox();
    const buttonBox = await button.boundingBox();
    assert.ok(headlineBox && buttonBox);
    assert.ok(Math.abs(headlineBox.y + headlineBox.height / 2 - buttonBox.y - buttonBox.height / 2) < 2);
  } finally { await browser.close(); }
});

it('propagates a supporting unit failure to every owning abstraction', { tags: ['failure-propagation'] }, async () => {
  const html = renderLineage(scenarios, [{ description: 'broken storage', tags: ['supports:store:1', 'component:Storage'], status: 'failed', logs: ['Expected toys, received error'] }], { brief: { problemStatement: 'Build forts', requirements: ['**REQ-001** Choose toys', '**REQ-002** Save forts'] } });
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    await page.route('http://report.test/**', route => route.fulfill({ contentType: 'text/html', body: html }));
    await page.goto('http://report.test/');
    for (const selector of ['[data-requirement="req-001"]', ...scenarios.map(s => `section[id="${s.id}"]`), '[data-component-spec]', '.step-evidence', '[data-unit-spec]']) {
      const nodes = page.locator(selector);
      assert.ok(await nodes.count(), selector);
      for (const node of await nodes.all()) assert.equal(await node.getAttribute('data-result'), 'failed', selector);
    }
    assert.notEqual(await page.locator('[data-requirement="req-002"]').getAttribute('data-result'), 'failed');
    const failedTitle = page.locator('[data-requirement="req-001"] > details > summary [data-spec-title]');
    assert.equal(await failedTitle.evaluate(node => getComputedStyle(node).color), 'rgb(161, 57, 48)');

    await page.locator('[data-requirement="req-001"] > details > summary [data-spec-title]').click();
    for (const id of ['journey:1', 'journey:1-step-1', 'api:1', 'api:1-step-1', 'store:1', 'store:1-step-1', 'unit-spec-0']) {
      await page.locator(`.focused-specification [data-spec-title][href="#spec=${encodeURIComponent(id)}"]`).first().click();
      await page.waitForFunction(id => document.querySelector('.focused-specification > *')?.id === id, id);
    }
    assert.equal(await page.getByText('Expected toys, received error', { exact: true }).isVisible(), true);
  } finally { await browser.close(); }
});
