import { readBrief } from '../core/brief.js';
import { evidenceText, cucumberEvidence } from './evidence.js';
import { editorOptions } from '../core/editor.js';
import { sourceReader } from './source.js';
import type { TestEvent } from 'node:test/reporters';
import { workingScenarios } from './load.js';
import { acceptedScenarios, saveReport } from './state.js';
import { renderLineage } from './report.js';
import type { LineageTest } from './report.js';

export default async function* lineageReporter(source: AsyncIterable<TestEvent>): AsyncGenerator<string> {
  const scenarios = workingScenarios(process.cwd());
  const sourceFor = sourceReader(process.cwd());
  const ancestors: string[] = [];
  const tests: LineageTest[] = [];
  let runFailed = false;
  const completed = new Map<string, LineageTest>();
  const locationKey = (data: { file?: string; line?: number; column?: number; nesting: number }) => JSON.stringify([data.file, data.line, data.column, data.nesting]);
  for await (const event of source) {
    if (event.type === 'test:diagnostic' && event.data.file) {
      const test = completed.get(locationKey(event.data));
      if (test && (test.logs?.length ?? 0) < 32) (test.logs ??= []).push(evidenceText(event.data.message));
    }
    if (event.type === 'test:enqueue') sourceFor(event.data);
    if (event.type === 'test:fail' && !event.data.skip && !event.data.todo) runFailed = true;
    if (event.type === 'test:summary' && event.data.success === false) runFailed = true;
    // Start/pass events arrive in reporting order, unlike enqueue/complete.
    // Declaration locations and worker-local IDs cannot identify shared helpers.
    if (event.type === 'test:start') {
      ancestors.length = event.data.nesting;
      ancestors.push(event.data.name);
    }
    if ((event.type === 'test:pass' || event.type === 'test:fail') && event.data.details.type !== 'suite'
      && !event.data.skip && !event.data.todo) {
      const test: LineageTest = { description: [...ancestors.slice(0, event.data.nesting), event.data.name].join(' › '),
        source: sourceFor(event.data), tags: event.data.tags, status: event.type === 'test:pass' ? 'passed' : 'failed' };
      if (event.type === 'test:fail') test.logs = [evidenceText(String(event.data.details.error?.stack ?? event.data.details.error ?? 'Test failed'))];
      tests.push(test); completed.set(locationKey(event.data), test);
    }
  }
  const root = process.cwd();
  const messages = process.env.AGENT_INTENT_CUCUMBER_MESSAGES;
  const acceptance = messages && process.env.AGENT_INTENT_CUCUMBER_ROOT === root
    ? cucumberEvidence(root, messages, scenarios) : undefined;
  const executions = acceptance?.executions;
  runFailed ||= acceptance?.runFailed ?? false;
  saveReport(root, { version: 1, scenarios, tests, executions, runFailed });
  yield renderLineage(scenarios, tests, { brief: readBrief(root), editor: editorOptions(process.cwd()), accepted: acceptedScenarios(root), executions, runFailed });
}
