import { After, Given, When, Then } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PresentationDriver } from '../support/presentation-driver.js';
import { createReview, approvalText } from '../../src/lineage/review.js';

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
  assert.match(text, /BEGIN INTENT DD APPROVAL/); assert.match(text, /Second specification/);
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
