import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import type { Envelope, FeatureChild } from '@cucumber/messages';
import { IntentError, object } from '../core/files.js';
import type { StoredScenario } from './state.js';

export interface StepEvidence {
  text: string;
  status: string;
  logs: string[];
  source?: { path: string; line: number };
}

export interface ScenarioExecution {
  scenarioId: string;
  name: string;
  exampleLine?: number;
  exampleValues?: Record<string, string>;
  attempt: number;
  willBeRetried: boolean;
  steps: StepEvidence[];
}

const textLimit = 8192;

export function evidenceText(value: string): string {
  const redacted = value
    .replace(/(\b(?:authorization|proxy-authorization|cookie|set-cookie|x-api-key|x-agent-intent-token):)[^\r\n]*/gi, '$1 [redacted]')
    .replace(/(<meta name="agent-intent-token" content=")[^"]*/gi, '$1[redacted]')
    .replace(/data:image\/[^;\s]+;base64,[a-z\d+/=]+/gi, '[inline image omitted]');
  return redacted.length <= textLimit ? redacted : redacted.slice(0, textLimit) + '\n[truncated]';
}

export function validExecution(value: unknown): value is ScenarioExecution {
  return object(value) && typeof value.scenarioId === 'string' && typeof value.name === 'string'
    && (value.exampleLine === undefined || Number.isSafeInteger(value.exampleLine))
    && (value.exampleValues === undefined || (object(value.exampleValues) && Object.values(value.exampleValues).every(cell => typeof cell === 'string')))
    && Number.isSafeInteger(value.attempt) && typeof value.willBeRetried === 'boolean'
    && Array.isArray(value.steps) && value.steps.every(step => object(step) && typeof step.text === 'string'
      && typeof step.status === 'string' && Array.isArray(step.logs) && step.logs.every(log => typeof log === 'string'));
}

/** Correlate Cucumber messages by attempt and test step IDs, never by step text. */
export function cucumberEvidence(root: string, path: string, scenarios: readonly StoredScenario[]): {
  executions: ScenarioExecution[]; runFailed: boolean;
} {
  const messages: Envelope[] = readFileSync(path, 'utf8').split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
  const finished = messages.findLast(message => message.testRunFinished)?.testRunFinished;
  if (!finished || typeof finished.success !== 'boolean') throw new IntentError('Incomplete Cucumber message stream');
  const known = new Set(scenarios.map(scenario => scenario.id));
  const paths = new Set(scenarios.map(scenario => scenario.path));
  const sources = new Map(messages.flatMap(({ source }) => source ? [[source.uri, source.data]] : []));
  const scenarioIds = new Map<string, string>();
  const stepKeywords = new Map<string, string>();
  const exampleLines = new Map<string, number>();
  const exampleValues = new Map<string, Record<string, string>>();
  for (const { gherkinDocument: doc } of messages) {
    if (!doc?.uri || !doc.feature) continue;
    const absolute = resolve(root, doc.uri);
    const file = relative(root, absolute).split('\\').join('/');
    if (!paths.has(file)) continue;
    if (sources.get(doc.uri) !== readFileSync(absolute, 'utf8')) throw new IntentError('Cucumber source changed since the run: ' + file);
    function index(children: readonly FeatureChild[]): void {
      for (const { background, rule, scenario } of children) {
        if (rule) index(rule.children);
        for (const step of background?.steps ?? scenario?.steps ?? []) stepKeywords.set(step.id, step.keyword);
        if (!scenario) continue;
        const id = file + ':' + scenario.location.line;
        if (known.has(id)) scenarioIds.set(scenario.id, id);
        for (const example of scenario.examples) {
          for (const row of example.tableBody) {
            exampleLines.set(row.id, row.location.line);
            exampleValues.set(row.id, Object.fromEntries((example.tableHeader?.cells ?? []).map((cell, index) => [cell.value, row.cells[index]?.value ?? ''])));
          }
        }
      }
    }
    index(doc.feature.children);
  }
  const pickles = new Map(messages.flatMap(({ pickle }) => pickle ? [[pickle.id, pickle]] : []));
  const definitions = new Map(messages.flatMap(({ stepDefinition }) => stepDefinition ? [[stepDefinition.id, stepDefinition.sourceReference]] : []));
  const cases = new Map(messages.flatMap(({ testCase }) => testCase ? [[testCase.id, testCase]] : []));
  const attempts = new Map(messages.flatMap(({ testCaseFinished }) => testCaseFinished ? [[testCaseFinished.testCaseStartedId, testCaseFinished]] : []));
  const stepKey = (attempt: string, step: string) => JSON.stringify([attempt, step]);
  const results = new Map<string, string>();
  const logs = new Map<string, string[]>();
  const errors = new Map<string, string>();
  for (const { attachment, testStepFinished } of messages) {
    if (testStepFinished) {
      results.set(stepKey(testStepFinished.testCaseStartedId, testStepFinished.testStepId), testStepFinished.testStepResult.status);
      const result = testStepFinished.testStepResult;
      const exception = result.exception;
      const detail = [...new Set([result.message, exception?.type, exception?.message, exception?.stackTrace, result.status === 'UNDEFINED' ? 'No matching step definition was found for this step.' : undefined].filter(Boolean))].join('\n');
      if (detail) errors.set(stepKey(testStepFinished.testCaseStartedId, testStepFinished.testStepId), evidenceText('Failure details\n' + detail));
    }
    if (!attachment?.testCaseStartedId || !attachment.testStepId || attachment.contentEncoding !== 'IDENTITY'
      || !['text/x.cucumber.log+plain', 'text/plain'].includes(attachment.mediaType)) continue;
    const key = stepKey(attachment.testCaseStartedId, attachment.testStepId);
    const entries = logs.get(key) ?? [];
    if (entries.length < 32) entries.push(evidenceText(attachment.body));
    else if (entries.length === 32) entries.push('[Additional log entries omitted]');
    logs.set(key, entries);
  }
  const executions: ScenarioExecution[] = [];
  for (const { testCaseStarted: started } of messages) {
    if (!started) continue;
    const testCase = cases.get(started.testCaseId);
    const pickle = testCase && pickles.get(testCase.pickleId);
    const scenarioId = pickle && scenarioIds.get(pickle.astNodeIds[0]);
    if (!testCase || !pickle || !scenarioId) continue;
    const finish = attempts.get(started.id);
    if (!finish) throw new IntentError('Incomplete Cucumber scenario attempt: ' + pickle.name);
    const stepsById = new Map(pickle.steps.map(step => [step.id, step]));
    const steps = testCase.testSteps.flatMap(testStep => {
      const step = testStep.pickleStepId && stepsById.get(testStep.pickleStepId);
      if (!step) return [];
      const key = stepKey(started.id, testStep.id);
      const reference = testStep.stepDefinitionIds?.map(id => definitions.get(id)).find(ref => ref?.uri && ref.location?.line);
      const source = reference?.uri && reference.location?.line ? { path: relative(root, resolve(root, reference.uri)).split('\\').join('/'), line: reference.location.line } : undefined;
      return [{ source, text: (stepKeywords.get(step.astNodeIds[0]) ?? '') + step.text,
        status: results.get(key) ?? 'UNKNOWN', logs: [...logs.get(key) ?? [], ...errors.has(key) ? [errors.get(key)!] : []] }];
    });
    executions.push({ scenarioId, name: pickle.name, exampleLine: exampleLines.get(pickle.astNodeIds[1]),
      exampleValues: exampleValues.get(pickle.astNodeIds[1]),
      attempt: started.attempt + 1, willBeRetried: finish.willBeRetried, steps });
  }
  return { executions, runFailed: !finished.success };
}
