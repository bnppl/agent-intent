import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readBrief } from '../../src/core/brief.js';
import { scenarios } from '../../src/core/gherkin.js';
import { renderLineage } from '../../src/lineage/report.js';
import { assert, logEvidence } from './evidence.js';

export class RequirementDriver {
  html = '';
  renamed = false;
  runFailed = false;
  render(): void {
    const root = mkdtempSync(join(tmpdir(), 'requirement-links-'));
    try {
      const brief = `## Problem statement\nBuild forts.\n## High-level requirements\n- **REQ-001** ${this.renamed ? 'Choose materials.' : 'Choose toys.'}\n- **REQ-002** Save forts.\n- **REQ-003** Share forts.\n- Legacy requirement.\n`;
      writeFileSync(join(root, 'intent.md'), brief);
      const feature = `@req-001\nFeature: Forts\n  @choose-toys\n  Scenario: Choose blocks\n    Given toys\n  @req-002 @save-forts\n  Scenario: Save fort\n    Given a fort\n`;
      const unlinked = `Feature: Other\n  @other ${this.renamed ? '@req-999' : ''}\n  Scenario: Other specification\n    Given something\n`;
      logEvidence('Requirement fixture', JSON.stringify({ brief, feature, unlinked }));
      this.html = renderLineage([...scenarios('forts.feature', Buffer.from(feature)), ...scenarios('other.feature', Buffer.from(unlinked))], [], { brief: readBrief(root), runFailed: this.runFailed });
      logEvidence('Rendered requirement groups', this.html.match(/<div id="scenario-groups"[\s\S]*?<\/main>/)?.[0] ?? this.html);
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
  globalRunStatus(): void {
    assert.equal((this.html.match(/Test run failed/g) ?? []).length, 1);
    const warning = this.html.indexOf('data-run-status');
    assert.ok(warning >= 0, 'Run warning has a report-level identity');
    assert.ok(warning < this.html.indexOf('<div data-stack-content>'), 'Run warning remains outside navigation content');
    assert.match(this.html, /Test run failed/);
  }
  noRequirementRunFailure(): void {
    for (const id of ['req-001', 'req-002', 'req-003', 'unlinked']) {
      assert.doesNotMatch(this.group(id), /Test run failed|Test run failed|data-run-status/);
    }
  }
  group(id: string): string {
    const html = this.html.match(new RegExp(`<article[^>]*data-requirement="${id}"[\\s\\S]*?</article>`))?.[0];
    assert.ok(html, `Requirement group ${id} is visible`);
    return html!;
  }
  linked(): void {
    assert.match(this.group('req-001'), /Choose blocks/);
    assert.doesNotMatch(this.group('req-001'), /Save fort<\/a><\/h2>/);
    assert.match(this.group('req-002'), /Save fort<\/a><\/h2>/);
    assert.equal((this.html.match(/Save fort<\/a><\/h2>/g) ?? []).length, 1);
  }
  gaps(): void {
    assert.match(this.group('req-003'), /No specifications linked/);
    assert.match(this.html, /Legacy requirement\./);
    assert.match(this.group('unlinked'), /Other specification/);
  }
  stable(): void {
    assert.match(this.group('req-001'), /Choose materials\./);
    this.linked();
    assert.match(this.group('unlinked'), /Other specification/);
    assert.match(this.group('unlinked'), /REQ-999/);
  }
  overview(): void {
    const main = this.html.match(/<main[\s\S]*?<\/main>/)?.[0] ?? '';
    assert.match(main, /data-report-stack/);
    assert.doesNotMatch(main, /Browse requirements|Select a scenario|class="legend"|class="report-nav"|Specifications and supporting tests/);
    assert.doesNotMatch(this.html, /<header>/);
    assert.match(main, /Build forts\./);
  }
  navigation(): void {
    const group = this.group('req-001');
    assert.match(group, /<details class="requirement-level">\s*<summary>/);
    assert.match(group, /class="stack-back"[^>]*>.*Back/);
    assert.match(group, /<details class="specification-level">/);
    assert.doesNotMatch(group, /data-run-group|data-change-group/);
  }

  wayfinding(): void {
    assert.match(this.html, /class="stack-navigation"/);
    assert.match(this.html, /data-stack-back[^>]*disabled/);
    assert.match(this.html, /aria-label="Breadcrumb"/);
    assert.match(this.html, /data-stack-depth="0"/);
    assert.match(this.html, /data-stack-content/);
  }

}
