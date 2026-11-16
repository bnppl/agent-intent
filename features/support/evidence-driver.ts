import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LineageDriver } from './lineage-driver.js';
import { assert, spawnWithEvidence } from './evidence.js';
import { reportModel } from '../../src/lineage/state.js';

const cucumber = fileURLToPath(new URL('../../node_modules/@cucumber/cucumber/bin/cucumber.js', import.meta.url));
const cucumberApi = fileURLToPath(new URL('../../node_modules/@cucumber/cucumber/lib/index.js', import.meta.url));

export class EvidenceDriver extends LineageDriver {
  fixtures(): void {
    this.write('features/outline.feature', `Feature: Example requests
  Background:
    Given a fixture
  Scenario Outline: Submit <value>
    Given a submission is ready
    When I submit "<value>"
    And I submit "<value>"
    Then the submission passes
    Examples:
      | value |
      | one   |
      | two   |
`);
    this.write('steps.cjs', `const { Given, When, Then } = require(${JSON.stringify(cucumberApi)});
Given('a fixture', function () { this.log('Fixture ready'); this.count = 0; });
// Deliberately emit no attachment from this step.
Given('a submission is ready', function () {});
When('I submit {string}', function (value) {
  this.value = value;
  this.log('Payload ' + value + ' #' + ++this.count);
  if (value === 'two') this.log('Authorization: Bearer fixture-secret\\n<script>unsafe()</script>');
});
Then('the submission passes', function () {
  this.log('Assertion: expected one, actual ' + this.value);
  require('node:assert/strict').equal(this.value, 'one');
});`);
    this.write('example.test.mjs', 'import { it } from "node:test"; it("supporting check", () => {});');
  }

  errorFixture(): void {
    this.fixtures();
    this.write('steps.cjs', readFileSync(join(this.root, 'steps.cjs'), 'utf8')
      .replace("this.log('Assertion: expected one, actual ' + this.value);", '')
      .replace("require('node:assert/strict').equal(this.value, 'one');", "if (this.value === 'two') throw Error('Web app failed: <renderer> unavailable');"));
  }

  assertError(): void {
    const runs = reportModel(this.root).snapshot.executions!;
    assert.ok(runs[1].steps.at(-1)!.logs.some(log => log.includes('Web app failed: <renderer> unavailable') && log.includes('steps.cjs')));
    assert.match(this.html(), /Web app failed: &lt;renderer&gt; unavailable/);
  }

  assertErrorAttribution(): void {
    const runs = reportModel(this.root).snapshot.executions!;
    assert.ok(runs[0].steps.every(step => !step.logs.some(log => log.includes('Web app failed'))));
  }

  collect(retry = 0): void {
    const file = join(this.root, 'messages.ndjson');
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    const result = spawnWithEvidence(process.execPath, [cucumber, '--require', 'steps.cjs', '--retry', String(retry), '--format', 'message:' + file],
      { cwd: this.root, env, encoding: 'utf8' });
    assert.equal(result.status, 1, result.stdout + result.stderr);
    this.run(['example.test.mjs'], 0, [], file);
  }

  assertPlacement(): void {
    const { executions } = reportModel(this.root).snapshot;
    assert.ok(executions);
    assert.deepEqual(executions.map(run => [run.exampleLine, run.steps.map(step => [step.text, step.logs[0]])]), [
      [11, [['Given a fixture', 'Fixture ready'], ['Given a submission is ready', undefined], ['When I submit "one"', 'Payload one #1'],
        ['And I submit "one"', 'Payload one #2'], ['Then the submission passes', 'Assertion: expected one, actual one']]],
      [12, [['Given a fixture', 'Fixture ready'], ['Given a submission is ready', undefined], ['When I submit "two"', 'Payload two #1'],
        ['And I submit "two"', 'Payload two #2'], ['Then the submission passes', 'Assertion: expected one, actual two']]],
    ]);
    const html = this.html();
    const rows = [...html.matchAll(/<details class="step-evidence"><summary>([^]*?)<\/summary>([^]*?)<\/details>/g)];
    assert.equal(rows.length, 8);
    assert.equal((html.match(/<div role="tabpanel"/g) ?? []).length, 2);
    for (const [run, value] of ['one', 'two'].entries()) {
      for (const [index, keyword] of ['When', 'And'].entries()) {
        const [, summary, evidence] = rows[run * 4 + index + 1];
        assert.ok(summary.replace(/<[^>]+>/g, '').includes(keyword + ' I submit &quot;' + value + '&quot;'));
        assert.ok(evidence.includes('Payload ' + value + ' #' + (index + 1)));
        assert.ok(!evidence.includes('Payload ' + (value === 'one' ? 'two' : 'one')));
      }
    }
    assert.deepEqual(executions.map(run => run.exampleValues), [{ value: 'one' }, { value: 'two' }]);
    assert.doesNotMatch(html, /Executed Gherkin steps/);
  }

  assertUnloggedStep(): void {
    const html = this.html().replace(/<\/?span\b[^>]*>/g, '');
    assert.match(html, /<div class="step-without-evidence"><code class="step-text">  Given a submission is ready<\/code>Passed<\/div>/);
  }

  assertFailure(): void {
    const { snapshot, accepted } = reportModel(this.root);
    assert.equal(snapshot.runFailed, true);
    assert.equal(snapshot.executions?.[1].steps.at(-1)?.status, 'FAILED');
    assert.deepEqual(accepted, []);
    const html = this.html();
    assert.match(html, /result-failed">Failed<\/span>[^]*?<code>Assertion: expected one, actual two<\/code>/);
    assert.match(html, /Authorization: \[redacted\]\n&lt;script&gt;unsafe\(\)&lt;\/script&gt;/);
    assert.doesNotMatch(html, /fixture-secret|<script>unsafe\(\)<\/script>/);
  }
}
