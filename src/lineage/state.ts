import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { sha256 } from '../core/gherkin.js';
import { hasSymlinkParent, IntentError, object, safePath } from '../core/files.js';
import { workingScenarios } from './load.js';
import type { LineageScenario, LineageTest } from './report.js';

export interface StoredScenario extends LineageScenario { key: string; definition: string; fingerprint: string }
export interface ReportSnapshot { version: 1; scenarios: StoredScenario[]; tests: LineageTest[]; runFailed?: boolean }
export interface ReportModel { snapshot: ReportSnapshot; accepted: StoredScenario[]; revision: string }
export interface AcceptSpecification { revision: string; key: string; expectedAcceptance: string | null }

function file(root: string, name: string): string {
  const path = name === 'lock' ? join(root, 'agent-intent.lock.json') : join(root, '.agent-intent', 'lineage', name + '.json');
  if (hasSymlinkParent(root, path) || (existsSync(path) && !lstatSync(path).isFile())) {
    throw new IntentError('Report state must use regular files without symlinks');
  }
  return path;
}

function read(root: string, name: string): unknown {
  const path = file(root, name);
  if (!existsSync(path)) return undefined;
  try { return JSON.parse(readFileSync(path, 'utf8')); }
  catch { throw new IntentError('Invalid lineage ' + name + ' state'); }
}

function write(root: string, name: string, value: unknown): void {
  const path = file(root, name), directory = join(root, '.agent-intent', 'lineage');
  mkdirSync(directory, { recursive: true });
  const temporary = mkdtempSync(join(directory, '.write-'));
  try { const candidate = join(temporary, 'state'); writeFileSync(candidate, JSON.stringify(value)); renameSync(candidate, path); }
  finally { rmSync(temporary, { recursive: true, force: true }); }
}

function validScenario(value: unknown): value is StoredScenario {
  return object(value) && ['id', 'path', 'name', 'key', 'definition', 'fingerprint'].every(key => typeof value[key] === 'string')
    && Array.isArray(value.tags) && value.tags.every(tag => typeof tag === 'string')
    && value.fingerprint === sha256(Buffer.from(value.definition as string));
}

export function acceptedScenarios(root: string): StoredScenario[] {
  const lock = read(root, 'lock');
  const value = lock === undefined ? read(root, 'accepted') : lock;
  if (value === undefined) return [];
  if (!object(value) || value.version !== 1 || !Array.isArray(value.scenarios) || !value.scenarios.every(validScenario)) {
    throw new IntentError('Invalid lineage acceptance state');
  }
  return value.scenarios;
}

export function saveReport(root: string, snapshot: ReportSnapshot): void { write(root, 'latest', snapshot); }

/** Call only after validating every decision in a human-authorised batch. */
export function writeAccepted(root: string, scenarios: StoredScenario[]): void {
  write(root, 'lock', { version: 1, scenarios });
}

function validTestSource(value: unknown): boolean {
  if (!object(value) || typeof value.path !== 'string' || typeof value.code !== 'string'
    || !Number.isSafeInteger(value.line) || Number(value.line) < 1) return false;
  try { safePath(value.path); return true; } catch { return false; }
}

export function reportModel(root: string): ReportModel {
  const value = read(root, 'latest');
  if (!object(value) || value.version !== 1 || !Array.isArray(value.scenarios) || !value.scenarios.every(validScenario)
    || (value.runFailed !== undefined && typeof value.runFailed !== 'boolean')
    || !Array.isArray(value.tests) || !value.tests.every(test => object(test) && typeof test.description === 'string'
      && Array.isArray(test.tags) && test.tags.every(tag => typeof tag === 'string')
      && (test.source === undefined || validTestSource(test.source))
      && (test.status === 'passed' || test.status === 'failed'))) {
    throw new IntentError('Generate a lineage report first: npm run test:lineage');
  }
  const snapshot = value as unknown as ReportSnapshot;
  return { snapshot, accepted: acceptedScenarios(root), revision: sha256(Buffer.from(JSON.stringify(snapshot))) };
}

export function acceptSpecification(root: string, request: AcceptSpecification): void {
  const model = reportModel(root);
  if (request.revision !== model.revision) throw new IntentError('Report changed; reload before accepting');
  const previous = model.accepted.find(scenario => scenario.key === request.key);
  if ((previous?.fingerprint ?? null) !== request.expectedAcceptance) throw new IntentError('Acceptance changed; reload before accepting');
  const candidate = model.snapshot.scenarios.find(scenario => scenario.key === request.key);
  if (!candidate && !previous) throw new IntentError('Specification not found in this report');
  const current = workingScenarios(root).find(scenario => scenario.key === request.key);
  if (current?.fingerprint !== candidate?.fingerprint) throw new IntentError('Specification changed since the report; rerun tests');
  const scenarios = model.accepted.filter(scenario => scenario.key !== request.key);
  if (candidate) scenarios.push(candidate);
  writeAccepted(root, scenarios);
}

/** Test runs never advance acceptance. Verification reads current source and the lock. */
export function verifyReport(root: string): void {
  const model = reportModel(root), current = workingScenarios(root);
  const reported = new Map(model.snapshot.scenarios.map(s => [s.key, s.fingerprint]));
  if (current.length !== reported.size || current.some(s => reported.get(s.key) !== s.fingerprint)) {
    throw new IntentError('Specifications changed since the report; rerun tests');
  }
  if (model.snapshot.runFailed || model.snapshot.tests.some(test => test.status === 'failed')) throw new IntentError('Tests failed in the latest report');
  const accepted = new Map(model.accepted.map(s => [s.key, s.fingerprint]));
  if (reported.size !== accepted.size || current.some(s => accepted.get(s.key) !== s.fingerprint)) {
    throw new IntentError('Specification acceptance required; review changes in the web interface');
  }
}
