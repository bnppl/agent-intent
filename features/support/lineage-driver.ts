/** Exercise the reporter through a real Node BDD test run in a temporary project. */
import { assert, logEvidence, spawnWithEvidence } from './evidence.js';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const reporter = fileURLToPath(new URL('../../runtime/lineage-reporter.cjs', import.meta.url));

export class LineageDriver {
  readonly root = mkdtempSync(join(tmpdir(), 'agent-intent-lineage-'));

  write(path: string, source: string): void {
    const full = join(this.root, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, source);
    logEvidence('Fixture written', path);
  }

  scenario(lineage: string): void {
    this.write('features/example.feature', `Feature: HTML reporting
  @${lineage}
  Scenario: List supporting unit tests
    Given related unit tests
`);
  }

  unitTests(lineage: string): void {
    this.write('example.test.mjs', `import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
describe('HTML reporting', () => {
  it('lists the first description', { tags: [${JSON.stringify(lineage)}] }, () => {
    assert.equal(1 + 1, 2);
    writeFileSync('test-executed', 'yes');
  });
  it('lists the second description', { tags: [${JSON.stringify(lineage)}] }, () => {
    assert.equal(2 + 2, 4);
  });
});
`);
  }

  run(files = ['example.test.mjs'], expectedStatus = 0, nodeOptions: string[] = [], cucumberMessages?: string): void {
    const env = { ...process.env };
    // A nested test command must start its own runner, not reuse the parent's context.
    delete env.NODE_TEST_CONTEXT;
    if (cucumberMessages) {
      env.AGENT_INTENT_CUCUMBER_ROOT = realpathSync(this.root);
      env.AGENT_INTENT_CUCUMBER_MESSAGES = cucumberMessages;
    }
    const result = spawnWithEvidence(process.execPath, [
      '--enable-source-maps', ...nodeOptions, '--test', '--test-reporter', reporter,
      '--test-reporter-destination', 'lineage.html', ...files,
    ], { cwd: this.root, env, encoding: 'utf8', timeout: 15000 });
    assert.equal(result.error, undefined);
    assert.equal(result.status, expectedStatus, result.stdout + result.stderr);
  }

  html(): string {
    assert.ok(existsSync(join(this.root, 'lineage.html')), 'The test run must create lineage.html');
    return readFileSync(join(this.root, 'lineage.html'), 'utf8');
  }

  close(): void {
    rmSync(this.root, { recursive: true, force: true });
  }
}
