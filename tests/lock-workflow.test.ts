import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PresentationDriver } from '../features/support/presentation-driver.js';

const cliPath = fileURLToPath(new URL('../runtime/cli.cjs', import.meta.url));
function cli(d: PresentationDriver, command: string) {
  return spawnSync(process.execPath, [cliPath, command], { cwd: d.root, encoding: 'utf8' });
}

describe('Accepted specification lock workflow', () => {
  it('serves the report from the project home page in an ordinary folder', { tags: ['report-home'] }, async () => {
    const d = new PresentationDriver();
    try {
      d.fixtures(); d.run();
      const response = await d.request('/');
      assert.equal(response.status, 200);
      assert.match(await response.text(), /<h2>First specification<\/h2>/);
      assert.equal((await d.request('/api/approval', {})).status, 404);
    } finally { await d.stop(); }
  });

  it('updates only the accepted entry in a portable specification lock file', { tags: ['lock-individual-acceptance'] }, async () => {
    const d = new PresentationDriver();
    try {
      d.fixtures(); d.run();
      assert.equal(existsSync(join(d.root, 'agent-intent.lock.json')), false);
      assert.equal((await d.accept('First specification')).status, 200);
      const lock = JSON.parse(readFileSync(join(d.root, 'agent-intent.lock.json'), 'utf8'));
      assert.equal(lock.version, 1);
      assert.deepEqual(lock.scenarios.map((s: { name: string }) => s.name), ['First specification']);
      d.run();
      const model = await d.model();
      assert.deepEqual(model.accepted.map(s => s.name), ['First specification']);
    } finally { await d.stop(); }
  });

  it('checks pending acceptance and failed tests against the lock', { tags: ['lock-verification', 'verification-failures'] }, async () => {
    const d = new PresentationDriver();
    try {
      d.fixtures(); d.run();
      assert.equal(cli(d, 'verify').status, 1);
      await d.acceptInitial();
      const verified = cli(d, 'verify');
      assert.equal(verified.status, 0, verified.stderr);
      d.write('example.test.mjs', `import { it } from 'node:test';
it('breaks the first promise', {tags:['first']}, () => { throw Error('fixture failure'); });`);
      d.run(['example.test.mjs'], 1);
      const failure = cli(d, 'verify');
      assert.equal(failure.status, 1);
      assert.match(failure.stderr, /failed/i);
    } finally { await d.stop(); }
  });

  it('refuses to verify a report when its source has since changed', { tags: ['verification-freshness'] }, async () => {
    const d = new PresentationDriver();
    try {
      await d.acceptInitial();
      d.write('features/example.feature', readFileSync(join(d.root, 'features/example.feature'), 'utf8')
        .replace('the first promise', 'an unreported promise'));
      const result = cli(d, 'verify');
      assert.equal(result.status, 1);
      assert.match(result.stderr, /rerun tests/i);
    } finally { await d.stop(); }
  });

  it('reads current specification source without requiring a test run', { tags: ['specification-source'] }, () => {
    const d = new PresentationDriver();
    try {
      d.fixtures();
      const result = cli(d, 'spec');
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /Scenario: First specification/);
      assert.match(result.stdout, /Given the first promise/);
    } finally { d.close(); }
  });
});

describe('Specification lock persistence', () => {
  it('preserves accepted definitions when individual acceptance creates the portable lock', { tags: ['lock-baseline-persistence'] }, async () => {
    const d = new PresentationDriver();
    try {
      d.fixtures(); d.run();
      const model = await d.model();
      d.write('.agent-intent/lineage/accepted.json', JSON.stringify({version: 1, scenarios: [model.snapshot.scenarios[0]]}));
      assert.deepEqual((await d.model()).accepted.map(s => s.name), ['First specification']);
      assert.equal(existsSync(join(d.root, 'agent-intent.lock.json')), false);
      assert.equal((await d.accept('Second specification')).status, 200);
      const lock = readFileSync(join(d.root, 'agent-intent.lock.json'), 'utf8');
      assert.deepEqual(JSON.parse(lock).scenarios.map((s: {name: string}) => s.name), ['First specification', 'Second specification']);
      // Once present, the portable lock is the authoritative acceptance baseline.
      d.write('.agent-intent/lineage/accepted.json', JSON.stringify({version: 1, scenarios: []}));
      assert.equal((await d.model()).accepted.length, 2);
    } finally { await d.stop(); }
  });

  it('rejects an invalid portable lock while preserving acceptance data', { tags: ['lock-invalid-state'] }, async () => {
    const d = new PresentationDriver();
    try {
      d.fixtures(); d.run();
      const model = await d.model();
      d.write('.agent-intent/lineage/accepted.json', JSON.stringify({version: 1, scenarios: model.snapshot.scenarios}));
      d.write('agent-intent.lock.json', 'null');
      const response = await d.request('/api/lineage');
      assert.equal(response.status, 409);
      assert.match(await response.text(), /Invalid lineage acceptance state/);
    } finally { await d.stop(); }
  });

  it('records an accepted removal without changing other accepted entries', { tags: ['lock-removal'] }, async () => {
    const d = new PresentationDriver();
    try {
      await d.acceptInitial();
      d.write('features/example.feature', `Feature: Reporting
  @first
  Scenario: First specification
    Given the first promise
`);
      d.run();
      assert.match(await d.page(), /data-change="removed"/);
      assert.equal((await d.accept('Second specification')).status, 200);
      assert.deepEqual((await d.model()).accepted.map(s => s.name), ['First specification']);
      assert.equal(cli(d, 'verify').status, 0);
    } finally { await d.stop(); }
  });
});

describe('Complete test-run outcome', () => {
  it('rejects a run whose suite teardown failed despite passing unit tests', { tags: ['verification-failures'] }, async () => {
    const d = new PresentationDriver();
    try {
      await d.acceptInitial();
      d.write('example.test.mjs', `import { after, describe, it } from 'node:test';
describe('Reporting', () => {
  after(() => { throw Error('fixture teardown failure'); });
  it('supports the first promise', {tags:['first']}, () => {});
  it('supports the second promise', {tags:['second']}, () => {});
});`);
      d.run(['example.test.mjs'], 1);
      const result = cli(d, 'verify');
      assert.equal(result.status, 1);
      assert.match(result.stderr, /failed/i);
      assert.match(await d.page(), /Test run failed/);
    } finally { await d.stop(); }
  });
});

describe('Local acceptance HTTP boundaries', () => {
  it('rejects cross-origin requests and unexpected hosts', { tags: ['acceptance-http-boundaries'] }, async () => {
    const d = new PresentationDriver();
    try {
      d.fixtures(); d.run();
      assert.equal((await d.request('/api/lineage/accept', {}, undefined, { Origin: 'https://example.invalid' })).status, 409);
      assert.equal(await d.rawStatus('/api/lineage', { Host: 'evil.example' }), 409);
      assert.equal((await d.request('/api/lineage', undefined, undefined, { 'Sec-Fetch-Site': 'cross-site' })).status, 409);
    } finally { await d.stop(); }
  });

  it('rejects malformed acceptance and non-JSON requests without writing a lock', { tags: ['acceptance-http-boundaries'] }, async () => {
    const d = new PresentationDriver();
    try {
      d.fixtures(); d.run();
      assert.equal((await d.request('/api/lineage/accept', { revision: 'bad', key: 1 })).status, 409);
      assert.equal((await d.request('/api/lineage/accept', {}, undefined, { 'Content-Type': 'text/plain' })).status, 415);
      assert.equal(existsSync(join(d.root, 'agent-intent.lock.json')), false);
      const response = await d.request('/');
      assert.match(response.headers.get('content-security-policy') ?? '', /script-src 'self'/);
      assert.equal(response.headers.get('cache-control'), 'no-store');
    } finally { await d.stop(); }
  });
});
