import assert from 'node:assert/strict';
import { it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PresentationDriver } from '../features/support/presentation-driver.js';

it('navigates pending changes without mutating acceptance and handles an empty review', {tags:['report-workbench-tabs']}, async () => {
  const d = new PresentationDriver();
  try {
    await d.acceptInitial();
    const lock = () => readFileSync(join(d.root, 'agent-intent.lock.json'), 'utf8');
    const before = lock();
    let html = await (await d.request('/?view=changes')).text();
    assert.match(html, /No specification changes awaiting acceptance/);
    assert.doesNotMatch(html, /<section[^>]*data-change=/);
    d.write('features/example.feature', readFileSync(join(d.root, 'features/example.feature'), 'utf8').replace('the first promise', 'a changed promise'));
    d.run();
    html = await (await d.request('/lineage?view=changes')).text();
    assert.match(html, /<h2>First specification<\/h2>/);
    assert.doesNotMatch(html, /<h2>Second specification<\/h2>/);
    assert.match(html, /aria-current="page"[^>]*>Changes/);
    const workflow = await (await d.request('/?view=workflow')).text();
    assert.match(workflow, /npm run test:lineage/);
    assert.doesNotMatch(workflow, /Mark as intent|Approve this staged revision|<section[^>]*data-result=/);
    const all = await (await d.request('/?view=unknown')).text();
    assert.match(all, /<h2>First specification<\/h2>/);
    assert.match(all, /<h2>Second specification<\/h2>/);
    assert.equal(lock(), before);
    // Acceptance in this disposable fixture leaves the changes view empty.
    assert.equal((await d.accept('First specification')).status, 200);
    assert.match(await (await d.request('/?view=changes')).text(), /No specification changes awaiting acceptance/);
    // Offline reports keep all content available without navigation scripts.
    assert.match(d.html(), /<h2>Second specification<\/h2>/);
    assert.doesNotMatch(d.html(), /<nav/);
  } finally { await d.stop(); }
});
