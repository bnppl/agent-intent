import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { sha256 } from './core/gherkin.js';
import { hasSymlinkParent, IntentError, object, safePath } from './core/files.js';

export interface DecisionProposal {
  id: string; title: string; journey: string; component: string; evidence: string; specification?: string;
}
export interface HumanDecision { classification: 'protect' | 'flexible'; scope: string; rationale: string; fingerprint: string }
export interface DecisionItem extends DecisionProposal { fingerprint: string; decision?: HumanDecision }
export interface DecisionInbox { version: 1; items: DecisionItem[]; revision: string }
const hash = (value: unknown) => sha256(Buffer.from(JSON.stringify(value)));
const nonempty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 32000;

function proposal(value: unknown): DecisionProposal {
  if (!object(value) || !['id', 'title', 'journey', 'component', 'evidence'].every(key => nonempty(value[key]))
    || (value.specification !== undefined && !nonempty(value.specification)) || String(value.id).length > 500) throw new IntentError('Invalid decision proposal: id, title, journey, component and evidence are required');
  return { id: value.id as string, title: value.title as string, journey: value.journey as string,
    component: value.component as string, evidence: value.evidence as string,
    ...(value.specification === undefined ? {} : { specification: value.specification as string }) };
}
function path(root: string): string {
  const result = join(root, '.agent-intent', 'decisions.json');
  if (hasSymlinkParent(root, result) || (existsSync(result) && (!lstatSync(result).isFile() || lstatSync(result).isSymbolicLink()))) throw new IntentError('Decision state must use regular files without symlinks');
  return result;
}
function validateDecision(value: unknown): value is HumanDecision {
  return object(value) && ['protect', 'flexible'].includes(String(value.classification)) && nonempty(value.scope)
    && nonempty(value.rationale) && typeof value.fingerprint === 'string' && /^[a-f0-9]{64}$/.test(value.fingerprint);
}
export function decisionInbox(root: string): DecisionInbox {
  const target = path(root);
  let items: DecisionItem[] = [];
  if (existsSync(target)) {
    let value: unknown;
    try { value = JSON.parse(readFileSync(target, 'utf8')); } catch { throw new IntentError('Invalid decision inbox state'); }
    if (!object(value) || value.version !== 1 || !Array.isArray(value.items)) throw new IntentError('Invalid decision inbox state');
    const ids = new Set<string>();
    items = value.items.map((entry: unknown) => {
      const input = proposal(entry);
      if (!object(entry) || entry.fingerprint !== hash(input) || ids.has(input.id)
        || (entry.decision !== undefined && !validateDecision(entry.decision))) throw new IntentError('Invalid decision inbox state');
      ids.add(input.id);
      return { ...input, fingerprint: entry.fingerprint as string, ...(entry.decision ? { decision: entry.decision as HumanDecision } : {}) };
    });
  }
  return { version: 1, items, revision: hash(items) };
}
function save(root: string, items: DecisionItem[]): void {
  const target = path(root), directory = join(root, '.agent-intent');
  mkdirSync(directory, { recursive: true });
  const temporary = mkdtempSync(join(directory, '.decisions-'));
  try { const file = join(temporary, 'state'); writeFileSync(file, JSON.stringify({ version: 1, items }, null, 2) + '\n'); renameSync(file, target); }
  finally { rmSync(temporary, { recursive: true, force: true }); }
}
export function importDecisionProposals(root: string, value: unknown): number {
  if (!object(value) || value.version !== 1 || !Array.isArray(value.items)) throw new IntentError('Expected version 1 decision proposals with an items array');
  const proposals = value.items.map(proposal), ids = new Set<string>();
  for (const item of proposals) { if (ids.has(item.id)) throw new IntentError('Duplicate decision identifier: ' + item.id); ids.add(item.id); }
  const current = decisionInbox(root), merged = new Map(current.items.map(item => [item.id, item]));
  for (const item of proposals) {
    const previous = merged.get(item.id);
    merged.set(item.id, { ...item, fingerprint: hash(item), ...(previous?.decision ? { decision: previous.decision } : {}) });
  }
  save(root, [...merged.values()]);
  return proposals.length;
}
export function classifyDecision(root: string, value: Record<string, unknown>): void {
  if (typeof value.id !== 'string' || typeof value.revision !== 'string'
    || !validateDecision({ ...value, fingerprint: '0'.repeat(64) })) throw new IntentError('A classification, scope and rationale are required');
  const inbox = decisionInbox(root);
  if (inbox.revision !== value.revision) throw new IntentError('Decision inbox changed; reload before classifying');
  const item = inbox.items.find(item => item.id === value.id);
  if (!item) throw new IntentError('Decision not found');
  item.decision = { classification: value.classification as HumanDecision['classification'], scope: value.scope as string,
    rationale: value.rationale as string, fingerprint: item.fingerprint };
  save(root, inbox.items);
}

/** Boundary adapter for the shared Mutation Testing Elements JSON format. */
export function importMutationReport(root: string, value: unknown): number {
  if (!object(value) || typeof value.schemaVersion !== 'string' || !/^[12](\.\d+){0,2}$/.test(value.schemaVersion)
    || !object(value.files)) throw new IntentError('Expected a Mutation Testing Elements schema version 1 or 2 report');
  const items: DecisionProposal[] = [];
  for (const [file, result] of Object.entries(value.files)) {
    safePath(file);
    if (!object(result) || typeof result.source !== 'string' || typeof result.language !== 'string' || !Array.isArray(result.mutants)) throw new IntentError('Invalid mutation file result');
    const ids = new Set<string>();
    for (const mutant of result.mutants) {
      if (!object(mutant) || !nonempty(mutant.id) || ids.has(mutant.id) || !nonempty(mutant.mutatorName)
        || !['Killed', 'Survived', 'NoCoverage', 'Timeout', 'RuntimeError', 'CompileError', 'Ignored', 'Pending'].includes(String(mutant.status))
        || !object(mutant.location) || !object(mutant.location.start) || !object(mutant.location.end)
        || ![mutant.location.start, mutant.location.end].every(point => Number.isSafeInteger(point.line) && Number(point.line) > 0 && Number.isSafeInteger(point.column) && Number(point.column) >= 0)) throw new IntentError('Invalid mutation result');
      ids.add(mutant.id);
      if (!['Survived', 'NoCoverage'].includes(String(mutant.status))) continue;
      items.push({ id: 'mutation:' + hash([file, mutant.id]), title: `${mutant.mutatorName} · ${file}:${mutant.location.start.line}`,
        journey: 'Unmapped mutation findings', component: file,
        evidence: JSON.stringify({ file, language: result.language, sourceFingerprint: hash(result.source), sourceContext: result.source.split('\n').slice(Math.max(0, Number(mutant.location.start.line) - 2), Number(mutant.location.end.line) + 1).join('\n').slice(0, 6000), mutant }, null, 2) });
    }
  }
  return importDecisionProposals(root, { version: 1, items });
}

export function decisionStatus(item: DecisionItem): 'unresolved' | 'protect' | 'flexible' {
  return item.decision?.fingerprint === item.fingerprint ? item.decision.classification : 'unresolved';
}
