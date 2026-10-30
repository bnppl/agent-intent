import { isDeepStrictEqual } from 'node:util';
import { IntentError, object } from '../core/files.js';
import { sha256 } from '../core/gherkin.js';
import { workingScenarios } from './load.js';
import { reportModel, writeAccepted } from './state.js';
import type { ReportModel } from './state.js';

export interface ApprovalRecord {
  key: string;
  name: string;
  path: string;
  proposed: string | null;
  expectedAcceptance: string | null;
}
export interface StaticReview { model: ReportModel; reviewId: string; records: ApprovalRecord[] }
const begin = '-----BEGIN AGENT INTENT APPROVAL-----';
const end = '-----END AGENT INTENT APPROVAL-----';

/** A review binds the entire report and baseline, including unselected specifications. */
export function createReview(root: string): StaticReview {
  const model = reportModel(root), current = workingScenarios(root);
  const reported = new Map(model.snapshot.scenarios.map(s => [s.key, s.fingerprint]));
  if (reported.size !== model.snapshot.scenarios.length || current.length !== reported.size
    || current.some(s => reported.get(s.key) !== s.fingerprint)) {
    throw new IntentError('Specifications changed since the report; rerun tests and export a fresh review');
  }
  const accepted = new Map(model.accepted.map(s => [s.key, s]));
  if (accepted.size !== model.accepted.length) throw new IntentError('Duplicate accepted specification keys');
  const records: ApprovalRecord[] = [];
  for (const scenario of [...model.snapshot.scenarios, ...model.accepted.filter(s => !reported.has(s.key))]) {
    const previous = accepted.get(scenario.key), proposed = reported.get(scenario.key) ?? null;
    if (proposed === (previous?.fingerprint ?? null)) continue;
    records.push({ key: scenario.key, name: scenario.name, path: scenario.path,
      proposed, expectedAcceptance: previous?.fingerprint ?? null });
  }
  const reviewId = sha256(Buffer.from(JSON.stringify({ version: 1, snapshot: model.snapshot, accepted: model.accepted })));
  return { model, reviewId, records };
}

export function approvalText(reviewId: string, decisions: readonly ApprovalRecord[]): string {
  return begin + '\n' + JSON.stringify({ version: 1, reviewId, decisions }, null, 2) + '\n' + end;
}

/** Accepts one selected batch or several copied per-specification envelopes, atomically. */
export function importApprovals(root: string, text: string): number {
  const review = createReview(root), selected: ApprovalRecord[] = [];
  const seen = new Set<string>();
  let remaining = text.replaceAll('\r\n', '\n').trim();
  if (!remaining) throw new IntentError('Paste at least one explicit approval envelope');
  while (remaining) {
    if (!remaining.startsWith(begin)) throw new IntentError('Invalid approval envelope; paste only complete approval blocks');
    const stop = remaining.indexOf('\n' + end, begin.length);
    if (stop < 0) throw new IntentError('Incomplete approval envelope');
    let value: unknown;
    try { value = JSON.parse(remaining.slice(begin.length, stop)); }
    catch { throw new IntentError('Invalid approval JSON'); }
    if (!object(value) || Object.keys(value).sort().join(',') !== 'decisions,reviewId,version'
      || value.version !== 1 || typeof value.reviewId !== 'string' || !Array.isArray(value.decisions)
      || value.decisions.length === 0) throw new IntentError('Invalid or empty version 1 approval batch');
    if (value.reviewId !== review.reviewId) throw new IntentError('Review or accepted baseline changed; approval is stale. Export a fresh review');
    for (const decision of value.decisions) {
      if (!object(decision) || typeof decision.key !== 'string') throw new IntentError('Invalid approval record');
      const expected = review.records.find(record => record.key === decision.key);
      if (!expected || !isDeepStrictEqual(decision, expected)) throw new IntentError('Unknown or altered approval record; copy it from a fresh review');
      if (seen.has(expected.key)) throw new IntentError('Duplicate approval record');
      seen.add(expected.key); selected.push(expected);
    }
    remaining = remaining.slice(stop + 1 + end.length).trim();
  }
  const scenarios = review.model.accepted.filter(s => !seen.has(s.key));
  for (const record of selected) {
    const candidate = review.model.snapshot.scenarios.find(s => s.key === record.key);
    if (candidate) scenarios.push(candidate);
  }
  // No await or callbacks between reading state, validating the complete batch and the single write.
  writeAccepted(root, scenarios);
  return selected.length;
}
