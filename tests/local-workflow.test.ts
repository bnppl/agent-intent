import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { cpSync, readFileSync, renameSync, rmSync, symlinkSync, unlinkSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { RepositoryDriver, FEATURE, GLUE, SUPPORT, PROJECT } from '../features/support/repository-driver.js';
import { report } from '../src/core/verification.js';

let d: RepositoryDriver;
beforeEach(() => { d = new RepositoryDriver(); });
afterEach(async () => { await d.close(); });

describe('Trusted pre-commit hook', () => {
  it('rejects a real commit that changes glue', () => {
    d.installTrusted(); d.write(GLUE, d.read(GLUE) + '\n// change\n'); d.stage(); const result = d.commit();
    assert.notEqual(result.status, 0); assert.match(String(result.stderr), /Human approval required/);
  });
  it('allows an explicitly approved exact revision and expires after commit', async () => {
    d.installTrusted(); d.write(GLUE, d.read(GLUE) + '\n// new rule\n'); d.stage();
    assert.equal((await d.approval()).status, 200); const result = d.commit(); assert.equal(result.status, 0, String(result.stderr)); assert.equal(report(d.repo).approved, false);
  });
  it('loads HEAD even if the candidate bundle and source always pass', () => {
    d.installTrusted(); d.write('runtime/cli.cjs', 'process.exit(0);\n'); d.write('src/cli.ts', 'process.exit(0);\n'); d.write(GLUE, '// weakened\n'); d.stage();
    const result = d.commit(); assert.notEqual(result.status, 0); assert.match(String(result.stderr), /Human approval required/);
  });
  it('clears Node preload environment before invoking the trusted verifier', () => {
    d.installTrusted(); d.write(GLUE, d.read(GLUE) + '\n// candidate\n');
    const marker = join(d.root, 'PRELOAD_EXECUTED');
    d.write('injected.cjs', 'require("node:fs").writeFileSync(' + JSON.stringify(marker) + ', "executed"); process.exit(0);\n'); d.stage();
    const result = spawnSync('git', ['-C', d.root, 'commit', '-m', 'Injected environment'], { encoding: 'utf8', env: { ...process.env, NODE_OPTIONS: '--require ' + JSON.stringify(join(d.root, 'injected.cjs')) } });
    assert.notEqual(result.status, 0); assert.match(result.stderr, /Human approval required/); assert.equal(existsSync(marker), false);
  });
  it('preserves an unrelated existing hook', () => {
    cpSync(join(PROJECT, 'runtime'), join(d.root, 'runtime'), { recursive: true }); d.stage(); d.git(['commit', '-qm', 'Install']);
    const path = join(d.root, '.git/hooks/pre-commit'); writeFileSync(path, '#!/bin/sh\nexit 0\n');
    const result = d.cli('install-hook'); assert.equal(result.status, 1); assert.match(String(result.stderr), /preserved/); assert.equal(readFileSync(path, 'utf8'), '#!/bin/sh\nexit 0\n');
  });
  it('preserves a custom hook manager configuration', () => {
    d.git(['config', 'core.hooksPath', '.custom-hooks']); assert.equal(d.cli('install-hook').status, 1); assert.equal(d.git(['config', '--get', 'core.hooksPath']), '.custom-hooks');
  });
  it('requires a committed bundle before installation', () => {
    const result = d.cli('install-hook'); assert.equal(result.status, 1); assert.match(String(result.stderr), /trusted HEAD/);
  });
  it('does not need node_modules or Python in the target repository', () => {
    d.installTrusted(); assert.equal(existsSync(join(d.root, 'node_modules')), false);
    d.write('application.ts', '// implementation refactor\n'); d.stage(); const result = d.commit(); assert.equal(result.status, 0, String(result.stderr));
  });
});

describe('Real annotation API', () => {
  it('rejects a stale source hash', async () => {
    const scenario = (await d.workspace()).scenarios[0]; d.write(FEATURE, d.read(FEATURE) + '\n# concurrent change\n');
    const result = await d.annotate(false, scenario); assert.equal(result.status, 409); assert.match(result.body, /File changed/); assert.match(d.read(FEATURE), /@intent/);
  });
  it('preserves other tags and CRLF when removing intent', async () => {
    d.write(FEATURE, Buffer.from('Feature: Booking\r\n  @fast @intent @smoke\r\n  Scenario: Keep tags\r\n    Given a booking exists\r\n'));
    const result = await d.annotate(false); assert.equal(result.status, 200, result.body);
    const source = d.read(FEATURE); assert.match(source, /@fast  @smoke\r\n/); assert.doesNotMatch(source, /@intent/); assert.equal(source.replaceAll('\r\n', '').includes('\n'), false);
  });
  it('adds intent without changing the rest of the source bytes', async () => {
    const source = 'Feature: Booking\r\n  @smoke\r\n  Scenario: Keep source\r\n    Given a booking exists\r\n'; d.write(FEATURE, source);
    const result = await d.annotate(true); assert.equal(result.status, 200, result.body); assert.equal(d.read(FEATURE), source.replace('  Scenario:', '  @intent\r\n  Scenario:')); assert.equal(d.git(['diff', '--cached', '--name-only']), '');
  });
  it('recognizes outlines, backgrounds, Rules, docstrings, and Examples', async () => {
    d.write(FEATURE, 'Feature: Examples\n  Background:\n    Given a booking exists\n  Rule: Booking rule\n    @intent\n    Scenario Outline: Keep <value>\n      Then the booking is preserved\n      """\n      @not_a_tag\n      """\n      Examples:\n        | value |\n        | one   |\n');
    d.stage(); assert.equal(report(d.repo).requiresApproval, true); const rows = (await d.workspace()).scenarios; assert.equal(rows.length, 1); assert.equal(rows[0].intent, true);
  });
  it('refuses to clear inherited Feature intent on a child', async () => {
    d.write(FEATURE, '@intent\nFeature: Booking\n  Scenario: Keep inherited\n    Given a booking exists\n');
    const result = await d.annotate(false); assert.equal(result.status, 409); assert.match(result.body, /inherited/);
  });
  it('rejects traversal and symbolic links', async () => {
    const scenario = (await d.workspace()).scenarios[0];
    const result = await d.request('POST', '/api/annotation', { path: '../outside.feature', line: 1, enabled: true, sourceHash: scenario.sourceHash }); assert.equal(result.status, 409);
    unlinkSync(join(d.root, FEATURE)); symlinkSync('../../application.ts', join(d.root, FEATURE));
    const linked = await d.annotate(false, scenario); assert.equal(linked.status, 409); assert.match(linked.body, /symlink/);
  });
});

describe('HTTP and approval boundaries', () => {
  it('rejects cross-origin writes', async () => { await d.start(); assert.equal((await d.request('POST', '/api/approval', {}, { Origin: 'https://example.invalid' })).status, 409); });
  it('rejects missing mutation tokens', async () => { await d.start(); assert.equal((await d.request('POST', '/api/approval', {}, { 'X-IntentDD-Token': '' })).status, 403); });
  it('rejects Host rebinding', async () => { await d.start(); assert.equal((await d.request('GET', '/api/workspace', undefined, { Host: 'evil.example' })).status, 409); });
  it('validates annotation types at runtime', async () => { await d.start(); assert.equal((await d.request('POST', '/api/annotation', { path: FEATURE, line: '1', enabled: 'yes', sourceHash: 'bad' })).status, 409); });
  it('requires explicit typed acknowledgement and a rationale', async () => {
    d.write(GLUE, d.read(GLUE) + '\n// edit\n'); d.stage();
    assert.equal((await d.approval(undefined, { acknowledgement: '' })).status, 409); assert.equal((await d.approval(undefined, { reason: '' })).status, 409); assert.equal(report(d.repo).approved, false);
  });
  it('rejects a tampered approval record', async () => {
    d.write(GLUE, d.read(GLUE) + '\n// candidate\n'); d.stage(); assert.equal((await d.approval()).status, 200);
    const path = join(d.repo.stateDir, 'approval.json'), value = JSON.parse(readFileSync(path, 'utf8')); value.payload.reviewer = 'Someone else'; writeFileSync(path, JSON.stringify(value)); assert.equal(report(d.repo).approved, false);
  });
  it('does not replay a prior Python-version approval format', async () => {
    d.write(GLUE, d.read(GLUE) + '\n// candidate\n'); d.stage(); assert.equal((await d.approval()).status, 200);
    const path = join(d.repo.stateDir, 'approval.json'), value = JSON.parse(readFileSync(path, 'utf8')); delete value.payload.version; writeFileSync(path, JSON.stringify(value)); assert.equal(report(d.repo).approved, false);
  });
});

describe('Conservative glue closure', () => {
  it('fails closed when all configured glue is removed', () => {
    rmSync(join(d.root, 'features/steps'), { recursive: true }); rmSync(join(d.root, 'features/support'), { recursive: true }); d.stage();
    const result = d.verify(); assert.equal(result.status, 1); assert.match(String(result.stderr), /no glue files/);
  });
  it('requires review of glue renames', () => { renameSync(join(d.root, GLUE), join(d.root, 'features/steps/renamed.ts')); d.stage(); assert.equal(d.verify().status, 1); });
  it('rejects symlinked glue', () => { unlinkSync(join(d.root, GLUE)); symlinkSync('../../application.ts', join(d.root, GLUE)); d.stage(); const result = d.verify(); assert.equal(result.status, 1); assert.match(String(result.stderr), /regular files/); });
  it('requires acceptance of newly marked intent', () => { d.write('features/new.feature', 'Feature: New\n  @intent\n  Scenario: New rule\n    Given a booking exists\n'); d.stage(); assert.equal(d.verify().status, 1); });
  it('builds the bootstrap spec from committed Gherkin, excluding staged proposals', () => {
    const accepted = d.read(FEATURE); d.write(FEATURE, accepted.replace('Preserve a booking', 'Unaccepted proposal')); d.stage();
    const result = d.cli('spec'); assert.equal(result.status, 0, String(result.stderr));
    assert.ok(String(result.stdout).includes(accepted)); assert.doesNotMatch(String(result.stdout), /Unaccepted proposal/);
  });
  it('protects glue regardless of implementation language', () => { d.write('features/steps/foreign.java', 'class Steps {}\n'); d.stage(); const result = d.verify(); assert.equal(result.status, 1); assert.match(String(result.stderr), /foreign.java/); });
  it('protects byte-level line-ending changes', () => { d.write(FEATURE, d.read(FEATURE).replaceAll('\n', '\r\n')); d.stage(); assert.equal(d.verify().status, 1); });
  it('protects changes to a runtime test hook', () => { d.write('features/hooks.ts', 'export function beforeScenario() {}\n'); d.stage(); assert.equal(d.verify().status, 1); });
  it('does not execute repository glue while verifying', () => { d.write(GLUE, 'throw Error("EXECUTED_UNTRUSTED_GLUE");\n'); d.stage(); const result = d.verify(); assert.equal(result.status, 1); assert.doesNotMatch(String(result.stderr), /Error: EXECUTED_UNTRUSTED_GLUE/); });
});
