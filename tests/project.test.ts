import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { symlinkSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { workingScenarios } from '../src/lineage/load.js';
import { LineageDriver } from '../features/support/lineage-driver.js';


describe('Project specification discovery', () => {
  it('rejects roots outside the project and symlinked specifications', { tags: ['specification-discovery-safety'] }, () => {
    const d = new LineageDriver();
    try {
      d.scenario('example');
      d.write('.agent-intent.json', JSON.stringify({version: 1, feature_roots: ['../outside']}));
      assert.throws(() => workingScenarios(d.root), /safe project-relative path/);
      d.write('.agent-intent.json', JSON.stringify({version: 1, feature_roots: ['features']}));
      d.write('other.feature', 'Feature: Other\n  Scenario: Other\n    Given other\n');
      unlinkSync(join(d.root, 'features/example.feature'));
      symlinkSync('../other.feature', join(d.root, 'features/example.feature'));
      assert.throws(() => workingScenarios(d.root), /symlinks/);
    } finally { d.close(); }
  });

  it('rejects symlinked configuration and malformed Gherkin', { tags: ['specification-discovery-safety'] }, () => {
    const d = new LineageDriver();
    try {
      d.scenario('example');
      d.write('config.json', JSON.stringify({version: 1, feature_roots: ['features']}));
      symlinkSync('config.json', join(d.root, '.agent-intent.json'));
      assert.throws(() => workingScenarios(d.root), /regular file/);
      unlinkSync(join(d.root, '.agent-intent.json'));
      d.write('features/example.feature', 'Scenario: No feature\n');
      assert.throws(() => workingScenarios(d.root), /Gherkin/);
    } finally { d.close(); }
  });

  it('retains inherited tags, outlines, docstrings and example values in the specification', { tags: ['specification-semantics'] }, () => {
    const d = new LineageDriver();
    try {
      d.write('features/example.feature', `@feature-tag
Feature: Reporting
  Rule: Related tests
    @rule-tag
    Scenario Outline: Keep <value>
      Given a value
        """
        meaningful text
        """
      Examples: Values
        | value |
        | one   |
`);
      const [first] = workingScenarios(d.root);
      assert.deepEqual(first.tags, ['@feature-tag', '@rule-tag']);
      assert.match(first.definition, /meaningful text/);
      assert.match(first.definition, /one/);
      d.write('features/example.feature', `@feature-tag
Feature: Reporting
  Rule: Related tests
    @rule-tag
    Scenario Outline: Keep <value>
      Given a value
        """
        meaningful text
        """
      Examples: Values
        | value |
        | two   |
`);
      assert.notEqual(workingScenarios(d.root)[0].fingerprint, first.fingerprint);
    } finally { d.close(); }
  });
});
