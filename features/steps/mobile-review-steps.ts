import { After, Given, When, Then } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PresentationDriver } from '../support/presentation-driver.js';
import { createReview, approvalText, importApprovals } from '../../src/lineage/review.js';

import { saveReport, reportModel, verifyReport } from '../../src/lineage/state.js';
import { StaticReviewDriver } from '../support/static-review-driver.js';
import { renderStaticReview } from '../../src/lineage/static-review.js';

interface MobileValidationWorld extends MobileWorld { staticReview?: StaticReviewDriver; beforeAcceptance?: string | null; rejectionPattern?: RegExp; unusualName?: string; exportedReview?: {html:string;text:string} }
interface MobileWorld { mobile?: PresentationDriver; copiedApproval?: string }
const cli = fileURLToPath(new URL('../../runtime/cli.cjs', import.meta.url));
function run(w: MobileWorld, args: string[], input?: string) {
  assert.ok(w.mobile);
  return spawnSync(process.execPath, [cli, ...args], { cwd: w.mobile.root, encoding: 'utf8', input });
}
Given('a mobile review project with two proposed specifications', function (this: MobileWorld) {
  this.mobile = new PresentationDriver(); this.mobile.fixtures(); this.mobile.run();
});
When('I export the mobile review files', function (this: MobileWorld) {
  const result = run(this, ['review', '--output', 'mobile']); assert.equal(result.status, 0, result.stderr);
});
Then('the static files show the specifications and copyable approval records', function (this: MobileWorld) {
  const html = readFileSync(join(this.mobile!.root, 'mobile.html'), 'utf8');
  const text = readFileSync(join(this.mobile!.root, 'mobile.txt'), 'utf8');
  assert.match(html, /Copy approvals/); assert.match(html, /First specification/);
  assert.match(text, /BEGIN AGENT INTENT APPROVAL/); assert.match(text, /Second specification/);
});
Then('no specifications have been accepted', function (this: MobileWorld) {
  assert.equal(existsSync(join(this.mobile!.root, 'intentdd.lock.json')), false);
});
Given('a copied approval for the first specification', function (this: MobileWorld) {
  const review = createReview(this.mobile!.root);
  this.copiedApproval = approvalText(review.reviewId, [review.records.find(r => r.name === 'First specification')!]);
});
When('I paste an approval for the first specification', function (this: MobileWorld) {
  const review = createReview(this.mobile!.root);
  const text = approvalText(review.reviewId, [review.records.find(r => r.name === 'First specification')!]);
  const result = run(this, ['approve'], text); assert.equal(result.status, 0, result.stderr);
});
Then('only the first specification is accepted', function (this: MobileWorld) {
  const lock = JSON.parse(readFileSync(join(this.mobile!.root, 'intentdd.lock.json'), 'utf8'));
  assert.deepEqual(lock.scenarios.map((s: { name: string }) => s.name), ['First specification']);
});
When('the second specification changes after review', function (this: MobileWorld) {
  const path = join(this.mobile!.root, 'features/example.feature');
  this.mobile!.write('features/example.feature', readFileSync(path, 'utf8').replace('the second promise', 'a changed promise'));
});
Then('importing the copied approval fails without accepting any specifications', function (this: MobileWorld) {
  const result = run(this, ['approve'], this.copiedApproval);
  assert.equal(result.status, 1); assert.match(result.stderr, /changed|rerun/i);
  assert.equal(existsSync(join(this.mobile!.root, 'intentdd.lock.json')), false);
});
After(function (this: MobileWorld) { this.mobile?.close(); });

function acceptanceBytes(w: MobileWorld): string | null {
  const path = join(w.mobile!.root, 'intentdd.lock.json');
  return existsSync(path) ? readFileSync(path, 'utf8') : null;
}
When('a pasted approval batch is {string}', function(this: MobileValidationWorld, problem: string) {
  const review = createReview(this.mobile!.root), record = review.records[0];
  let text = approvalText(review.reviewId, [record]);
  if (problem === 'empty') text = approvalText(review.reviewId, []);
  else if (problem === 'duplicate') text += '\n' + text;
  else if (problem === 'unknown') text = approvalText(review.reviewId, [record, {...record, key:'unknown'}]);
  else if (problem === 'tampered') text = approvalText(review.reviewId, [{...record, proposed:'bad'}]);
  else if (problem === 'malformed') text += '\nplease approve everything';
  else if (problem === 'extra-field') text = text.replace('"version": 1', '"extra": true, "version": 1');
  else if (problem === 'wrong-version') text = text.replace('"version": 1', '"version": 2');
  else if (problem === 'mixed-review') text += '\n' + approvalText('wrong-review', [record]);
  else assert.fail('Unknown batch problem: ' + problem);
  this.copiedApproval = text; this.beforeAcceptance = acceptanceBytes(this);
  this.rejectionPattern = problem === 'tampered' ? /altered approval record/i : undefined;
});
Then('importing that batch fails without changing acceptance', function(this: MobileValidationWorld) {
  assert.ok(this.copiedApproval);
  assert.throws(() => importApprovals(this.mobile!.root, this.copiedApproval!), this.rejectionPattern ?? Error);
  assert.equal(acceptanceBytes(this), this.beforeAcceptance);
});
When('the mobile review becomes stale through {string}', function(this: MobileValidationWorld, change: string) {
  const d = this.mobile!;
  if (change === 'source') d.write('features/example.feature', readFileSync(join(d.root, 'features/example.feature'), 'utf8').replace('the first promise','a changed promise'));
  else if (change === 'report') saveReport(d.root, {...reportModel(d.root).snapshot, runFailed:true});
  else if (change === 'baseline' || change === 'replay') {
    const review = createReview(d.root);
    importApprovals(d.root, change === 'replay' ? this.copiedApproval! : approvalText(review.reviewId, [review.records[1]]));
  } else assert.fail('Unknown stale change: ' + change);
  this.beforeAcceptance = acceptanceBytes(this); this.rejectionPattern = /stale|changed|rerun/i;
});
When('I import separate approval blocks for both specifications', function(this: MobileWorld) {
  const review = createReview(this.mobile!.root);
  assert.equal(importApprovals(this.mobile!.root, review.records.map(r => approvalText(review.reviewId,[r])).join('\n')), 2);
});
When('the second mobile specification is removed and reported', function(this: MobileWorld) {
  const d = this.mobile!;
  d.write('features/example.feature', readFileSync(join(d.root, 'features/example.feature'), 'utf8').split('  @second')[0]);
  d.run();
});
When('I import its removal approval', function(this: MobileWorld) {
  const review = createReview(this.mobile!.root);
  assert.equal(review.records.length, 1); assert.equal(review.records[0].proposed, null);
  assert.equal(importApprovals(this.mobile!.root, approvalText(review.reviewId,review.records)), 1);
});
When('the reported test run has failed', function(this: MobileWorld) {
  const root = this.mobile!.root; saveReport(root, {...reportModel(root).snapshot, runFailed:true});
});
Then('the test run remains failed and verification fails', function(this: MobileWorld) {
  assert.equal(reportModel(this.mobile!.root).snapshot.runFailed, true);
  assert.throws(() => verifyReport(this.mobile!.root), /failed/i);
});
When('I approve a delimiter-like scenario name using CRLF text', function(this: MobileWorld) {
  const d = this.mobile!, path = join(d.root, 'features/example.feature');
  d.write('features/example.feature', readFileSync(path,'utf8').replace('Scenario: First specification','Scenario: -----END AGENT INTENT APPROVAL-----'));
  d.run(); const review = createReview(d.root);
  assert.equal(importApprovals(d.root, approvalText(review.reviewId,[review.records[0]]).replaceAll('\n','\r\n')), 1);
});
Then('that exact scenario is accepted', function(this: MobileWorld) {
  assert.deepEqual(reportModel(this.mobile!.root).accepted.map(s => s.name), ['-----END AGENT INTENT APPROVAL-----']);
});
When('I export a review with a {string} specification name', function(this: MobileValidationWorld, kind: string) {
  assert.ok(['script-like','dollar-replacement'].includes(kind));
  this.unusualName = kind === 'script-like' ? '</script><script>window.injected=true</script>' : "$$ $& $` $'";
  const d = this.mobile!;
  d.write('features/example.feature', readFileSync(join(d.root,'features/example.feature'),'utf8').replace('Scenario: First specification', () => 'Scenario: '+this.unusualName));
  d.run(); this.exportedReview = renderStaticReview(createReview(d.root));
});
Then('embedded review records preserve the original name as inert text', function(this: MobileValidationWorld) {
  const html = this.exportedReview!.html;
  const data = html.match(/<script id="review-data" type="application\/json">(.*?)<\/script>/s)![1];
  assert.doesNotMatch(data, /</);
  assert.deepEqual(JSON.parse(data).records, createReview(this.mobile!.root).records);
  assert.equal(JSON.parse(data).records[0].name, this.unusualName);
  assert.equal((html.match(/<script>/g) ?? []).length, 1);
});

When('I select the first change in the exported review and copy approvals', async function(this: MobileValidationWorld) {
  this.staticReview = new StaticReviewDriver(renderStaticReview(createReview(this.mobile!.root)).html);
  await this.staticReview.select(0); await this.staticReview.copy();
});
Then('the copied text contains only the first approval and acceptance is unchanged', function(this: MobileValidationWorld) {
  const review = createReview(this.mobile!.root);
  assert.deepEqual(this.staticReview!.copied, [approvalText(review.reviewId,[review.records[0]])]);
  assert.equal(acceptanceBytes(this), null);
});
When('I clear the exported selection', async function(this: MobileValidationWorld) { await this.staticReview!.clear(); });
Then('the approval text is empty and copying is disabled', function(this: MobileValidationWorld) {
  assert.equal(this.staticReview!.control('approval-text').value, '');
  assert.equal(this.staticReview!.control('copy-approvals').disabled, true);
  assert.ok(this.staticReview!.choices.every(choice => !choice.checked));
});
When('a page is restored after selecting a change', async function(this: MobileValidationWorld) {
  await this.staticReview!.select(1); await this.staticReview!.restore();
});
When('I copy a selected exported approval with clipboard access {string}', async function(this: MobileValidationWorld, access: string) {
  assert.ok(access === 'missing' || access === 'denied');
  this.staticReview = new StaticReviewDriver(renderStaticReview(createReview(this.mobile!.root)).html, access);
  await this.staticReview.select(0); await this.staticReview.copy();
});
Then('the exact selected approval text is selected for manual copying', function(this: MobileValidationWorld) {
  const d = this.staticReview!, output = d.control('approval-text'), review = createReview(this.mobile!.root);
  assert.equal(output.value, approvalText(review.reviewId,[review.records[0]]));
  assert.equal(output.focused, true); assert.equal(output.selected, true);
  assert.deepEqual(output.selection,[0,output.value.length]); assert.deepEqual(d.copied,[]);
  assert.match(d.control('copy-message').textContent,/copy it manually/);
});
