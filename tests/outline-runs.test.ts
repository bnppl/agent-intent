import { it } from 'node:test';
import { OutlineRunsDriver } from '../features/support/outline-runs-driver.js';
it('isolates concrete example evidence and keeps nested links usable from every tab', { tags: ['outline-run-tabs', 'outline-run-links', 'outline-run-keyboard'] }, async () => {
  const driver = new OutlineRunsDriver();
  try {
    driver.fixtures(); driver.collect(); await driver.open();
    await driver.tabs(); await driver.panel('one'); await driver.failing(); await driver.panel('two');
    await driver.arguments(); await driver.links(); await driver.keyboard();
  } finally { await driver.shutdown(); }
});

it('keeps retries in separate execution panels', { tags: ['outline-run-retries'] }, async () => {
  const driver = new OutlineRunsDriver();
  try { driver.fixtures(); driver.collect(1); await driver.open(); await driver.retries(); }
  finally { await driver.shutdown(); }
});

it('keeps substituted source readable when an outline execution has incomplete evidence', { tags: ['outline-run-tabs'] }, async () => {
  const { renderLineage } = await import('../src/lineage/report.js');
  const { default: assert } = await import('node:assert/strict');
  const definition = JSON.stringify({ contexts: [], scenario: { keyword: 'Scenario Outline', name: 'Choose <value>',
    steps: [{ keyword: 'Given ', text: 'a <value>' }, { keyword: 'Then ', text: 'keep <value>' }] } });
  const html = renderLineage([{ id: 'outline:1', path: 'outline.feature', name: 'Choose <value>', tags: [], definition }], [], {
    executions: [{ scenarioId: 'outline:1', name: 'Choose block', exampleLine: 8, exampleValues: { value: 'block' }, attempt: 1, willBeRetried: false,
      steps: [{ text: 'Then misplaced evidence', status: 'FAILED', logs: ['Do not attach to the wrong step'] }] }],
  });
  assert.match(html, /Given[^]*?a block/);
  assert.match(html, /Then[^]*?keep block/);
  assert.doesNotMatch(html, /Then misplaced evidence|Do not attach to the wrong step|  undefined/);
});
