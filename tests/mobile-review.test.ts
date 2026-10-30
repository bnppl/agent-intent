import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { workingScenarios } from '../src/lineage/load.js';
import { saveReport, reportModel, verifyReport } from '../src/lineage/state.js';
import { createReview, importApprovals, approvalText } from '../src/lineage/review.js';
import { StaticReviewDriver } from '../features/support/static-review-driver.js';
import { renderStaticReview } from '../src/lineage/static-review.js';

const feature = 'Feature: Mobile\n  @first\n  Scenario: First\n    Given first promise\n  @second\n  Scenario: Second\n    Given second promise\n';
const cli = fileURLToPath(new URL('../runtime/cli.cjs', import.meta.url));
function project(run: (root: string) => void) {
  const root = mkdtempSync(join(tmpdir(), 'intentdd-mobile-'));
  try { mkdirSync(join(root, 'features')); writeFileSync(join(root, 'features/review.feature'), feature); report(root); run(root); }
  finally { rmSync(root, { recursive: true, force: true }); }
}
function report(root: string, runFailed = false) { saveReport(root, { version: 1, scenarios: workingScenarios(root), tests: [], runFailed }); }
function lock(root: string) { return reportModel(root).accepted; }
function bytes(root: string) { const p = join(root, 'intentdd.lock.json'); return existsSync(p) ? readFileSync(p, 'utf8') : null; }

describe('Static mobile approval protocol', () => {
  it('accepts only selected definitions and rejects replay', {tags:['mobile-selection', 'mobile-stale-review']}, () => project(root => {
    const review = createReview(root);
    assert.equal(bytes(root), null);
    const text = approvalText(review.reviewId, [review.records[0]]);
    assert.equal(importApprovals(root, text), 1);
    assert.deepEqual(lock(root).map(s => s.name), ['First']);
    assert.throws(() => importApprovals(root, text), /stale|changed/i);
    assert.throws(() => verifyReport(root), /acceptance/i);
  }));

  it('batches separate copied records and explicitly accepts removals', {tags:['mobile-removal']}, () => project(root => {
    const initial = createReview(root);
    importApprovals(root, initial.records.map(record => approvalText(initial.reviewId, [record])).join('\n'));
    const first = lock(root)[0];
    writeFileSync(join(root, 'features/review.feature'), feature.split('  @second')[0]); report(root);
    const review = createReview(root);
    assert.equal(review.records.length, 1); assert.equal(review.records[0].proposed, null);
    importApprovals(root, approvalText(review.reviewId, review.records));
    assert.deepEqual(lock(root), [first]);
  }));

  for (const kind of ['empty', 'duplicate', 'unknown', 'tampered', 'malformed', 'extra-field', 'wrong-version', 'mixed-review']) {
    it('rejects ' + kind + ' batches without changing any lock bytes', {tags:['mobile-invalid-approval']}, () => project(root => {
      let review = createReview(root);
      importApprovals(root, approvalText(review.reviewId, [review.records[0]]));
      review = createReview(root); const before = bytes(root), record = review.records[0]!;
      let text = approvalText(review.reviewId, [record]);
      if (kind === 'empty') text = approvalText(review.reviewId, []);
      if (kind === 'duplicate') text += '\n' + text;
      if (kind === 'unknown') text = approvalText(review.reviewId, [record, { ...record, key: 'unknown' }]);
      if (kind === 'tampered') text = approvalText(review.reviewId, [{ ...record, proposed: 'bad' }]);
      if (kind === 'malformed') text += '\nplease approve everything';
      if (kind === 'extra-field') text = text.replace('"version": 1', '"extra": true, "version": 1');
      if (kind === 'wrong-version') text = text.replace('"version": 1', '"version": 2');
      if (kind === 'mixed-review') text += '\n' + approvalText('wrong-review', [record]);
      assert.throws(() => importApprovals(root, text),
        kind === 'tampered' ? /altered approval record/i : Error);
      assert.equal(bytes(root), before);
    }));
  }

  for (const kind of ['source', 'report', 'baseline', 'unselected-source']) {
    it('rejects a stale ' + kind + ' without writing acceptance', {tags:[kind === 'unselected-source' ? 'mobile-stale-source' : 'mobile-stale-review']}, () => project(root => {
      const review = createReview(root), text = approvalText(review.reviewId, [review.records[0]]);
      if (kind === 'source') writeFileSync(join(root, 'features/review.feature'), feature.replace('first promise', 'changed promise'));
      if (kind === 'unselected-source') writeFileSync(join(root, 'features/review.feature'), feature.replace('second promise', 'changed promise'));
      if (kind === 'report') report(root, true);
      if (kind === 'baseline') importApprovals(root, approvalText(review.reviewId, [review.records[1]]));
      const before = bytes(root);
      assert.throws(() => importApprovals(root, text), /changed|stale|rerun/i); assert.equal(bytes(root), before);
    }));
  }

  it('records specification agreement independently of failing run outcomes', {tags:['mobile-failed-run']}, () => project(root => {
    report(root, true); const review = createReview(root);
    importApprovals(root, approvalText(review.reviewId, review.records));
    assert.equal(reportModel(root).snapshot.runFailed, true);
    assert.throws(() => verifyReport(root), /failed/i);
  }));

  it('handles delimiter-like scenario names and CRLF pasted text literally', {tags:['mobile-paste-format']}, () => project(root => {
    writeFileSync(join(root, 'features/review.feature'), feature.replace('Scenario: First', 'Scenario: -----END INTENT DD APPROVAL-----'));
    report(root); const review = createReview(root);
    assert.equal(importApprovals(root, approvalText(review.reviewId, [review.records[0]]).replaceAll('\n', '\r\n')), 1);
  }));
});

describe('Mobile review CLI and offline files', () => {
  it('preserves dollar replacement sequences literally in embedded decisions', {tags:['mobile-inert-content']}, () => project(root => {
    writeFileSync(join(root, 'features/review.feature'), feature.replace('Scenario: First', () => "Scenario: $$ $& $` $'"));
    report(root); const review = createReview(root), files = renderStaticReview(review);
    const data = files.html.match(/<script id="review-data" type="application\/json">(.*?)<\/script>/s)![1];
    assert.deepEqual(JSON.parse(data).records, review.records);
  }));
  it('keeps hostile specification text inert in HTML and embedded review data', {tags:['mobile-inert-content']}, () => project(root => {
    writeFileSync(join(root, 'features/review.feature'), feature.replace('Scenario: First', 'Scenario: </script><script>window.injected=true</script>'));
    report(root); const review = createReview(root), files = renderStaticReview(review);
    assert.equal((files.html.match(/<script>/g) ?? []).length, 1);
    assert.match(files.html, /&lt;script&gt;window.injected=true/);
    const data = files.html.match(/<script id="review-data" type="application\/json">(.*?)<\/script>/s)![1];
    assert.doesNotMatch(data, /</); assert.deepEqual(JSON.parse(data).records, review.records);
    assert.match(files.text, /window.injected=true/);
  }));
  it('exports self-contained selectable HTML and text without accepting anything', {tags:['mobile-export']}, () => project(root => {
    const output = join(root, 'mobile');
    const result = spawnSync(process.execPath, [cli, 'review', '--output', output], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const html = readFileSync(output + '.html', 'utf8'), text = readFileSync(output + '.txt', 'utf8');
    assert.match(html, /Copy approvals/); assert.match(html, /textarea/); assert.match(html, /Previously accepted/);
    assert.match(html, /type="checkbox"/); assert.doesNotMatch(html, /\schecked(?:\s|>)/);
    assert.doesNotMatch(html, /<script[^>]+src=|<link[^>]+href=/);
    assert.match(text, /First/); assert.match(text, /second promise/); assert.match(text, /BEGIN INTENT DD APPROVAL/);
    assert.equal(bytes(root), null);
  }));

  it('imports an exact pasted envelope from stdin and from a file', {tags:['mobile-selection']}, () => project(root => {
    let review = createReview(root);
    let result = spawnSync(process.execPath, [cli, 'approve'], { cwd: root, encoding: 'utf8', input: approvalText(review.reviewId, [review.records[0]]) });
    assert.equal(result.status, 0, result.stderr); assert.equal(lock(root).length, 1);
    review = createReview(root); const path = join(root, 'approval.txt');
    writeFileSync(path, approvalText(review.reviewId, review.records));
    result = spawnSync(process.execPath, [cli, 'approve', '--file', path], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr); assert.equal(lock(root).length, 2);
  }));
});

describe('Exported mobile selection events', () => {
  it('copies only the selected records, clears selection and resets restored pages without accepting', {tags:['mobile-copy-selection']}, async () => {
    const root = mkdtempSync(join(tmpdir(), 'intentdd-mobile-events-'));
    try {
      mkdirSync(join(root,'features')); writeFileSync(join(root,'features/review.feature'),feature); report(root);
      const review = createReview(root), before = bytes(root);
      const d = new StaticReviewDriver(renderStaticReview(review).html);
      assert.equal(d.control('approval-text').value, ''); assert.equal(d.control('copy-approvals').disabled, true);
      await d.select(0);
      assert.equal(d.control('copy-approvals').disabled, false);
      assert.match(d.control('approval-summary').textContent, /1 selected: First/);
      await d.copy();
      assert.deepEqual(d.copied, [approvalText(review.reviewId,[review.records[0]])]);
      await d.select(1); await d.select(0, false); await d.copy();
      assert.equal(d.copied[1], approvalText(review.reviewId,[review.records[1]]));
      await d.clear();
      assert.ok(d.choices.every(c => !c.checked)); assert.equal(d.control('approval-text').value, '');
      assert.equal(d.control('copy-approvals').disabled, true);
      await d.select(0); await d.restore();
      assert.ok(d.choices.every(c => !c.checked)); assert.equal(d.control('approval-text').value, '');
      assert.equal(d.control('copy-approvals').disabled, true); assert.equal(bytes(root), before);
    } finally { rmSync(root,{recursive:true,force:true}); }
  });
  for (const clipboard of ['missing','denied'] as const) {
    it('selects the exact current approval text when clipboard access is '+clipboard, {tags:['mobile-copy-fallback']}, async () => {
      const root = mkdtempSync(join(tmpdir(), 'intentdd-mobile-events-'));
      try {
        mkdirSync(join(root,'features')); writeFileSync(join(root,'features/review.feature'),feature); report(root);
        const review = createReview(root), d = new StaticReviewDriver(renderStaticReview(review).html, clipboard);
        await d.select(1); await d.copy();
        const output = d.control('approval-text');
        assert.equal(output.value, approvalText(review.reviewId,[review.records[1]]));
        assert.equal(output.focused, true); assert.equal(output.selected, true);
        assert.deepEqual(output.selection, [0,output.value.length]); assert.deepEqual(d.copied, []);
        assert.match(d.control('copy-message').textContent, /copy it manually/); assert.equal(bytes(root), null);
      } finally { rmSync(root,{recursive:true,force:true}); }
    });
  }
});
