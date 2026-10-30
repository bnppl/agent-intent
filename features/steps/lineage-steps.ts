import { After, Given, Then, When } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { IntentWorld } from '../hooks.js';
import { LineageDriver } from '../support/lineage-driver.js';

type LineageWorld = IntentWorld & { lineage?: LineageDriver };

function driver(world: LineageWorld): LineageDriver {
  assert.ok(world.lineage, 'Lineage fixture is missing');
  return world.lineage;
}

Given('a Gherkin scenario tagged {string}', function (this: LineageWorld, lineage: string) {
  this.lineage = new LineageDriver();
  this.lineage.scenario(lineage);
});

Given('BDD-style unit tests with the same lineage tag', function (this: LineageWorld) {
  driver(this).unitTests('test-lineage');
});

When('the tests run successfully with HTML reporting enabled', function (this: LineageWorld) {
  driver(this).run();
  assert.equal(readFileSync(join(driver(this).root, 'test-executed'), 'utf8'), 'yes');
});

Then('an HTML interface is generated', function (this: LineageWorld) {
  assert.match(driver(this).html(), /<!doctype html>/i);
});

Then('the scenario can be expanded to show its associated unit-test descriptions', function (this: LineageWorld) {
  // Native details/summary provides mouse and keyboard disclosure without scripts.
  assert.match(driver(this).html(), /<details>\s*<summary>[\s\S]*?<h2>List supporting unit tests<\/h2>[\s\S]*?<\/summary>[\s\S]*?<ul>[\s\S]*?<\/ul>[\s\S]*?<\/details>/);
});

Then("the scenario lists the associated unit tests' BDD descriptions", function (this: LineageWorld) {
  const html = driver(this).html();
  assert.match(html, /<h2>List supporting unit tests<\/h2>/);
  assert.match(html, /<li[^>]*>HTML reporting › lists the first description<span[^>]*>Passed<\/span><details class="test-code">[\s\S]*?<\/details><\/li>/);
  assert.match(html, /<li[^>]*>HTML reporting › lists the second description<span[^>]*>Passed<\/span><details class="test-code">[\s\S]*?<\/details><\/li>/);
  assert.match(html, /<details class="test-code"><summary aria-label="View test code" title="View test code"><span aria-hidden="true">&lt;\/&gt;<\/span><\/summary>/);
  assert.doesNotMatch(html, /<details class="test-code"[^>]*\bopen\b/);
});

After(function (this: LineageWorld) { this.lineage?.close(); });
