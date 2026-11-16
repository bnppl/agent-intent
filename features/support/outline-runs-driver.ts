import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Browser, type Page } from 'playwright';
import { EvidenceDriver } from './evidence-driver.js';
import { assert, logEvidence } from './evidence.js';
import { renderLineage } from '../../src/lineage/report.js';
import { reportModel } from '../../src/lineage/state.js';

export class OutlineRunsDriver extends EvidenceDriver {
  browser?: Browser;
  page?: Page;
  fixtures(): void {
    super.fixtures();
    const path = join(this.root, 'features/outline.feature');
    this.write('features/outline.feature', readFileSync(path, 'utf8')
      .replace('  Scenario Outline:', '  @outline-parent @req-001\n  Scenario Outline:')
      .replace('    When I submit "<value>"', '    When I submit "<value>"\n      """\n      Document <value> & <markup>\n      """')
      .replace('    And I submit "<value>"', '    And I submit "<value>"\n      | value | markup |\n      | <value> | <markup> |')
      .replace('    Examples:\n      | value |', '    Examples:\n      | value | markup |')
      .replace('| one   |', '| one   | <strong>one</strong> |')
      .replace('| two   |', '| two   | <strong>two</strong> |'));
    this.write('steps.cjs', readFileSync(join(this.root, 'steps.cjs'), 'utf8').replace('function (value)', 'function (value, argument)'));
    this.write('features/nested.feature', `@supports:outline-parent:3 @component:API\nFeature: Nested evidence\n  @nested-example\n  Scenario: Inspect submission\n    Given a fixture\n`);
  }
  async open(): Promise<void> {
    const { snapshot } = reportModel(this.root);
    const html = renderLineage(snapshot.scenarios, snapshot.tests, {
      brief: { problemStatement: 'Inspect example runs', requirements: ['**REQ-001** Inspect submissions'] },
      executions: snapshot.executions,
    });
    this.browser = await chromium.launch({ channel: 'chrome', headless: true });
    this.page = await this.browser.newPage({ viewport: { width: 390, height: 844 } });
    this.page.setDefaultTimeout(2500);
    this.page.on('pageerror', error => { throw error; });
    await this.page.route('http://report.test/**', route => route.fulfill({ contentType: 'text/html', body: html }));
    const id = snapshot.scenarios.find(scenario => scenario.tags.includes('@outline-parent'))!.id;
    await this.page.goto('http://report.test/#spec=' + encodeURIComponent(id));
    logEvidence('Opened outline report', id);
  }
  async tabs(): Promise<void> {
    const tabs = this.page!.getByRole('tab');
    assert.equal(await tabs.count(), 2);
    assert.equal(await tabs.nth(0).innerText(), '1');
    assert.equal(await tabs.nth(1).innerText(), '2');
    const description = this.page!.locator('.focused-specification .outline-description > .gherkin-scenario');
    assert.equal(await description.count(), 1);
    const heading = await description.boundingBox();
    const strip = await this.page!.getByRole('tablist').boundingBox();
    assert.ok(heading && strip && heading.y + heading.height <= strip.y, 'Examples follow the outline description');
    assert.match(await this.page!.getByRole('tablist').innerText(), /Examples:/);
    assert.equal(await tabs.nth(0).getAttribute('aria-selected'), 'true');
  }
  async panel(value: string): Promise<void> {
    const panel = this.page!.getByRole('tabpanel');
    assert.equal(await panel.count(), 1);
    await panel.locator(':scope > .gherkin-source > details').evaluateAll(details => details.forEach(detail => { detail.setAttribute('open', ''); }));
    const text = await panel.innerText();
    logEvidence('Selected run content', text);
    assert.match(text, new RegExp('Payload ' + value + ' #1'));
    assert.doesNotMatch(text, new RegExp('Payload ' + (value === 'one' ? 'two' : 'one')));
    assert.ok(text.includes('When I submit "' + value + '"'));
    assert.doesNotMatch(text, /<value>|<markup>/);
    if (value === 'two') assert.match(text, /Failed/);
  }
  async failing(): Promise<void> { await this.page!.getByRole('tab').nth(1).click(); }
  async arguments(): Promise<void> {
    const panel = this.page!.getByRole('tabpanel');
    const text = await panel.innerText();
    assert.ok(text.includes('Document two & <strong>two</strong>'));
    assert.ok(text.includes('| two | <strong>two</strong> |'));
    assert.equal(await panel.locator('strong').filter({ hasText: 'two' }).count(), 0);
    assert.equal(await panel.locator('script').count(), 0);
  }
  async links(): Promise<void> {
    for (let index = 0; index < 2; index++) {
      await this.page!.getByRole('tab').nth(index).click();
      const panel = this.page!.getByRole('tabpanel');
      await panel.locator('.step-evidence').nth(2).evaluate(detail => { detail.setAttribute('open', ''); });
      const link = panel.getByRole('link', { name: 'Inspect submission', exact: true });
      assert.equal(await link.count(), 1);
      const target = decodeURIComponent((await link.getAttribute('href'))!.slice(6));
      await link.click();
      await this.page!.waitForFunction(id => document.querySelector('.focused-specification > section')?.id === id, target);
      assert.equal(await this.page!.locator('.focused-specification > section h2').first().innerText(), 'Inspect submission');
      await this.page!.getByRole('button', { name: 'Go back one level' }).click();
      await this.page!.waitForFunction(() => !!document.querySelector('.focused-specification [role=tablist]'));
      await this.page!.getByRole('tab').nth(index).waitFor();
      assert.equal(await this.page!.getByRole('tab').nth(index).getAttribute('aria-selected'), 'true');
    }
    const ids = await this.page!.locator('[id]').evaluateAll(nodes => nodes.map(node => node.id));
    assert.equal(new Set(ids).size, ids.length, 'Every tab, step and nested spec has a unique ID');
  }
  async keyboard(): Promise<void> {
    const tabs = this.page!.getByRole('tab');
    await tabs.first().focus();
    for (const [key, index] of [['ArrowRight', 1], ['Home', 0], ['End', 1], ['ArrowRight', 0]] as const) {
      await this.page!.keyboard.press(key);
      assert.equal(await tabs.nth(index).getAttribute('aria-selected'), 'true');
      assert.equal(await tabs.nth(index).evaluate(tab => tab === document.activeElement), true);
    }
    assert.equal(await this.page!.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  }
  async retries(): Promise<void> {
    const tabs = this.page!.getByRole('tab');
    assert.equal(await tabs.count(), 3);
    for (const [index, attempt] of [[1, 1], [2, 2]]) {
      await tabs.nth(index).click();
      assert.match(await this.page!.getByRole('tabpanel').innerText(), new RegExp('Attempt ' + attempt));
      await this.panel('two');
      assert.equal(await this.page!.getByRole('tabpanel').locator('.step-run').count(), 5);
    }
  }
  async shutdown(): Promise<void> { await this.browser?.close(); super.close(); }
}
