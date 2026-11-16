import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const temporary = mkdtempSync(join(tmpdir(), 'agent-intent-cucumber-'));
const messages = join(temporary, 'messages.ndjson');
function run(args, env = process.env) {
  const result = spawnSync(process.execPath, args, { env, stdio: 'inherit' });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

try {
  const acceptance = run(['--import', 'tsx', 'node_modules/@cucumber/cucumber/bin/cucumber.js', '--format', 'message:' + messages]);
  const tests = readdirSync('tests').filter(file => file.endsWith('.test.ts')).sort().map(file => join('tests', file));
  // Always generate the report, including the evidence from failing Cucumber steps.
  const lineage = run(['--enable-source-maps', '--import', 'tsx', '--test', '--test-reporter=spec',
    '--test-reporter-destination=stdout', '--test-reporter=./runtime/lineage-reporter.cjs',
    '--test-reporter-destination=test-lineage.html', ...tests], {
    ...process.env, AGENT_INTENT_CUCUMBER_ROOT: process.cwd(), AGENT_INTENT_CUCUMBER_MESSAGES: messages,
  });
  process.exitCode = acceptance || lineage;
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
