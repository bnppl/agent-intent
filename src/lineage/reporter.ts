import type { TestEvent } from 'node:test/reporters';
import { workingScenarios } from './load.js';
import { acceptedScenarios, saveReport } from './state.js';
import { renderLineage } from './report.js';
import type { LineageTest } from './report.js';

export default async function* lineageReporter(source: AsyncIterable<TestEvent>): AsyncGenerator<string> {
  const scenarios = workingScenarios(process.cwd());
  const ancestors: string[] = [];
  const tests: LineageTest[] = [];
  let runFailed = false;
  for await (const event of source) {
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
      tests.push({ description: [...ancestors.slice(0, event.data.nesting), event.data.name].join(' › '),
        tags: event.data.tags, status: event.type === 'test:pass' ? 'passed' : 'failed' });
    }
  }
  saveReport(process.cwd(), { version: 1, scenarios, tests, runFailed });
  yield renderLineage(scenarios, tests, { accepted: acceptedScenarios(process.cwd()), runFailed });
}
