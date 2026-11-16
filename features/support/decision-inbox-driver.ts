import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium, type Browser, type Page, type Response } from 'playwright';
import { assert, spawnWithEvidence, logEvidence } from './evidence.js';
import { spawn, type ChildProcess } from 'node:child_process';

export class DecisionInboxDriver {
  root = mkdtempSync(join(tmpdir(), 'decision-inbox-'));
  proposal = { id: 'material-order', title: 'Material ordering', journey: 'Choose three pieces', component: 'Web App', evidence: 'Alphabetical or catalogue order', specification: '@select-three-building-pieces' };
  browser?: Browser; page?: Page; server?: ChildProcess; origin = ''; revision = ''; token = ''; html = ''; before = ''; classificationBody = '';
  cli(args: string[], success = true) {
    const result = spawnWithEvidence(process.execPath, [resolve('runtime/cli.cjs'), '--root', this.root, ...args], { encoding: 'utf8' });
    if (success) assert.equal(result.status, 0, result.stderr); else assert.notEqual(result.status, 0);
    return result;
  }
  proposals() {
    writeFileSync(join(this.root, 'intent.md'), '## Problem statement\nBuild forts.\n## High-level requirements\n- Choose pieces.\n');
    writeFileSync(join(this.root, 'proposals.json'), JSON.stringify({ version: 1, items: [this.proposal, { ...this.proposal, id: 'preview', title: 'Preview lighting' }] }));
    this.cli(['decisions', '--file', join(this.root, 'proposals.json')]);
  }
  async open() {
    this.server = spawn(process.execPath, [resolve('runtime/cli.cjs'), '--root', this.root, 'serve', '--port', '0']);
    this.origin = await new Promise<string>((done, reject) => {
      const timer = setTimeout(() => reject(Error('Server did not start')), 10000);
      this.server!.stdout!.on('data', chunk => { const match = String(chunk).match(/http:\/\/127\.0\.0\.1:\d+/); if (match) { clearTimeout(timer); done(match[0]); } });
      this.server!.stderr!.on('data', chunk => logEvidence('Fixture server stderr', String(chunk)));
      this.server!.once('exit', code => { clearTimeout(timer); reject(Error('Server exited: ' + code)); });
    });
    this.browser = await chromium.launch({ channel: 'chrome', headless: true });
    this.page = await this.browser.newPage();
    await this.page.route('**/api/decisions/classify', async route => {
      const response = await route.fetch();
      this.classificationBody = await response.text();
      await route.fulfill({ response, body: this.classificationBody });
    });
    const landing = await this.page.goto(this.origin);
    if (landing) await this.responseEvidence(landing);
    await this.page.getByRole('link', { name: /^Decisions/ }).click();
    this.html = await this.page.content();
    this.token = await this.page.locator('meta[name="agent-intent-token"]').getAttribute('content') ?? '';
    this.revision = await this.page.locator('meta[name="decision-revision"]').getAttribute('content') ?? '';
    logEvidence('Browser navigation', this.page.url());
  }
  async responseEvidence(response: Response) {
    const request = response.request();
    logEvidence('Browser HTTP request', `${request.method()} ${request.url()}\nSession token header omitted\nBody: ${request.postData() ?? '(no body)'}`);
    logEvidence('Browser HTTP response', `${response.status()}\n${JSON.stringify(await response.allHeaders())}\n${(response.url().endsWith('/api/decisions/classify') ? this.classificationBody : await response.text()).slice(0, 6000)}\n[body bounded to 6000 characters]`);
  }
  async grouped() {
    await this.page!.locator('[data-decision-id="material-order"]').getByText('Evidence', { exact: true }).click();
    const text = await this.page!.locator('main').innerText(); logEvidence('Decision inbox', text);
    for (const expected of ['Choose three pieces', 'Web App', 'Alphabetical or catalogue order', '@select-three-building-pieces', '2 unresolved']) assert.ok(text.includes(expected), expected);
  }
  async classify() {
    const before = readFileSync(join(this.root, '.agent-intent', 'decisions.json'), 'utf8');
    const denied = await this.page!.request.post(this.origin + '/api/decisions/classify', { data: { revision: this.revision, id: 'material-order', classification: 'flexible', scope: 'Ordering', rationale: 'Unauthorized request' } });
    logEvidence('Unauthenticated classification response', `${denied.status()} ${await denied.text()}`);
    assert.equal(denied.status(), 403);
    assert.equal(readFileSync(join(this.root, '.agent-intent', 'decisions.json'), 'utf8'), before);
    const row = this.page!.locator('[data-decision-id="material-order"]');
    await row.getByLabel('Classification').selectOption('flexible');
    await row.getByLabel('Scope').fill('Ordering only; quantities and selection limit remain protected.');
    await row.getByLabel('Rationale').fill('Either order supports choosing pieces.');
    const [response] = await Promise.all([this.page!.waitForResponse(response => response.url().endsWith('/api/decisions/classify')), row.getByRole('button', { name: 'Record decision' }).click()]);
    await this.responseEvidence(response);
    assert.equal(response.status(), 200);
    await this.page!.waitForFunction(() => document.body.textContent?.includes('1 unresolved'));
    logEvidence('Human fixture classification', await row.innerText().catch(() => 'Reloaded inbox'));
  }
  independent() {
    assert.equal(existsSync(join(this.root, 'agent-intent.lock.json')), false);
    const state = JSON.parse(readFileSync(join(this.root, '.agent-intent', 'decisions.json'), 'utf8'));
    assert.equal(state.items.find((item: { id: string }) => item.id === 'material-order').decision.classification, 'flexible');
  }
  async unresolved() {
    await this.page!.reload();
    assert.ok((await this.page!.locator('main').innerText()).includes('Preview lighting'));
    assert.equal(await this.page!.locator('[data-decision-id="preview"]').getAttribute('data-status'), 'unresolved');
  }
  change() {
    this.proposal.evidence = 'Ordering changed; review again';
    writeFileSync(join(this.root, 'changed.json'), JSON.stringify({ version: 1, items: [this.proposal] }));
    this.cli(['decisions', '--file', join(this.root, 'changed.json')]);
    this.before = readFileSync(join(this.root, '.agent-intent', 'decisions.json'), 'utf8');
  }
  async stale() {
    const response = await this.page!.request.post(this.origin + '/api/decisions/classify', { headers: { 'X-Agent-Intent-Token': this.token }, data: { revision: this.revision, id: 'material-order', classification: 'flexible', scope: 'Ordering', rationale: 'Reviewed' } });
    logEvidence('Stale classification response', `${response.status()} ${await response.text()}`);
    assert.equal(response.status(), 409);
    assert.equal(readFileSync(join(this.root, '.agent-intent', 'decisions.json'), 'utf8'), this.before);
  }
  mutations() {
    writeFileSync(join(this.root, 'intent.md'), '## Problem statement\nBuild forts.\n## High-level requirements\n- Choose pieces.\n');
    this.writeMutations('<=');
  }
  writeMutations(replacement: string) {
    logEvidence('Mutation fixture', `Shared-format report: src/rules.js; one Survived mutation (${replacement}), one Killed mutation; source=count < 3`);
    writeFileSync(join(this.root, 'mutation.json'), JSON.stringify({ schemaVersion: '1', thresholds: { high: 80, low: 60 }, files: { 'src/rules.js': { language: 'javascript', source: 'count < 3', mutants: [
      { id: '1', mutatorName: 'EqualityOperator', replacement, location: { start: { line: 1, column: 0 }, end: { line: 1, column: 9 } }, status: 'Survived' },
      { id: '2', mutatorName: 'BooleanLiteral', replacement: 'false', location: { start: { line: 1, column: 0 }, end: { line: 1, column: 9 } }, status: 'Killed' },
    ] } } }));
  }
  importMutations() { this.cli(['mutations', '--file', join(this.root, 'mutation.json')]); }
  async mutationEvidence() {
    await this.open();
    await this.page!.getByText('Evidence', { exact: true }).click();
    const text = await this.page!.locator('main').innerText(); logEvidence('Mutation inbox', text);
    assert.ok(text.includes('Survived')); assert.ok(text.includes('src/rules.js')); assert.ok(text.includes('1 unresolved'));
    assert.equal(await this.page!.locator('[data-decision-id]').count(), 1);
  }
  async reimport() {
    const row = this.page!.locator('[data-decision-id]').first();
    await row.getByLabel('Classification').selectOption('protect');
    await row.getByLabel('Scope').fill('Three-piece limit'); await row.getByLabel('Rationale').fill('Add a boundary assertion.');
    const [response] = await Promise.all([this.page!.waitForResponse(response => response.url().endsWith('/api/decisions/classify')), row.getByRole('button', { name: 'Record decision' }).click()]);
    await this.responseEvidence(response);
    assert.equal(response.status(), 200);
    await this.page!.waitForFunction(() => document.body.textContent?.includes('0 unresolved'));
    this.importMutations(); await this.page!.reload();
    assert.equal(await this.page!.locator('[data-decision-id]').first().getAttribute('data-status'), 'protect');
    this.writeMutations('>'); this.importMutations(); await this.page!.reload();
    assert.equal(await this.page!.locator('[data-decision-id]').first().getAttribute('data-status'), 'unresolved');
    assert.ok((await this.page!.locator('main').innerText()).includes('Previous decision'));
  }
  duplicates() {
    this.before = readFileSync(join(this.root, '.agent-intent', 'decisions.json'), 'utf8');
    writeFileSync(join(this.root, 'duplicate.json'), JSON.stringify({ version: 1, items: [this.proposal, this.proposal] }));
    this.cli(['decisions', '--file', join(this.root, 'duplicate.json')], false);
  }
  preserved() { assert.equal(readFileSync(join(this.root, '.agent-intent', 'decisions.json'), 'utf8'), this.before); }
  async close() { await this.browser?.close(); this.server?.kill(); rmSync(this.root, { recursive: true, force: true }); }
}
