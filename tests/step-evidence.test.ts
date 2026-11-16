import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { reportModel } from '../src/lineage/state.js';
import { it } from 'node:test';
import { EvidenceDriver } from '../features/support/evidence-driver.js';

it('associates Cucumber step logs by execution and preserves failed evidence as escaped text',
  { tags: ['step-evidence', 'step-evidence-failure'] }, () => {
    const driver = new EvidenceDriver();
    try {
      driver.fixtures();
      driver.collect();
      driver.assertUnloggedStep();
      driver.assertPlacement();
      const steps = reportModel(driver.root).snapshot.executions!.flatMap(run => run.steps);
      assert.ok(steps.every(step => step.source?.path === 'steps.cjs' && step.source.line > 0), 'Executed steps retain their real glue declaration line');
      driver.assertFailure();
    } finally {
      driver.close();
    }
  });

it('retains the thrown error without requiring an attached log', { tags: ['step-error-message'] }, () => {
  const driver = new EvidenceDriver();
  try {
    driver.fixtures();
    driver.write('steps.cjs', readFileSync(join(driver.root, 'steps.cjs'), 'utf8').replace("this.log('Assertion: expected one, actual ' + this.value);", '').replace("require('node:assert/strict').equal(this.value, 'one');", "if (this.value === 'two') throw Error('Web app failed: <renderer> unavailable');"));
    driver.collect();
    const runs = reportModel(driver.root).snapshot.executions!;
    assert.ok(runs[1].steps.at(-1)!.logs.some(log => log.includes('Web app failed: <renderer> unavailable') && log.includes('steps.cjs')));
    assert.ok(runs[0].steps.every(step => !step.logs.some(log => log.includes('Web app failed'))));
    assert.match(driver.html(), /Web app failed: &lt;renderer&gt; unavailable/);
  } finally { driver.close(); }
});

it('explains undefined steps in the report evidence', { tags: ['step-error-message'] }, () => {
  const driver = new EvidenceDriver();
  try {
    driver.fixtures();
    driver.write('steps.cjs', readFileSync(join(driver.root, 'steps.cjs'), 'utf8').replace("Given('a submission is ready'", "Given('an unrelated submission'"));
    driver.collect();
    const steps = reportModel(driver.root).snapshot.executions!.flatMap(run => run.steps);
    assert.ok(steps.filter(step => step.status === 'UNDEFINED').every(step => step.logs.some(log => log.includes('No matching step definition'))));
    assert.match(driver.html(), /No matching step definition was found/);
  } finally { driver.close(); }
});
