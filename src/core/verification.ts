import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { closeSync, mkdirSync, mkdtempSync, openSync, readFileSync, renameSync, rmSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { scenarios } from './gherkin.js';
import { IntentError, Repository, safePath, under } from './repository.js';
import type { Snapshot } from './repository.js';
import type { ApprovalPayload, ApprovalRequest, Config, ProtectedChange, Review, Revision, Scenario } from './types.js';

export const MANDATORY_CONTROLS = ['src', 'runtime', 'scripts', 'intentdd', '.intentdd.json', '.agents', 'AGENTS.md',
  'package.json', 'package-lock.json', 'tsconfig.json', 'cucumber.mjs', '.github', '.githooks', 'requirements.txt', 'requirements.lock'];
export const DEFAULT_CONFIG: Config = { version: 1, feature_roots: ['features'],
  glue_roots: ['features/steps', 'features/support', 'features/hooks.ts', 'features/environment.py'], control_paths: MANDATORY_CONTROLS };
export function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
export function config(snapshot: Snapshot): Config {
  const blob = snapshot.get('.intentdd.json');
  if (blob && !['100644', '100755'].includes(blob.mode)) throw new IntentError('Configuration must be a regular file');
  let cfg: unknown;
  try { cfg = blob ? JSON.parse(blob.data.toString('utf8')) : structuredClone(DEFAULT_CONFIG); }
  catch { throw new IntentError('Invalid .intentdd.json: expected JSON'); }
  if (!object(cfg) || cfg.version !== 1) throw new IntentError('Invalid .intentdd.json: unsupported configuration version');
  for (const field of ['feature_roots', 'glue_roots', 'control_paths']) {
    const roots = cfg[field];
    if (!Array.isArray(roots) || (field !== 'control_paths' && !roots.length)) throw new IntentError(field + ' must be a nonempty path list');
    for (const path of roots) safePath(path);
  }
  return cfg as unknown as Config;
}
export function catalogue(snapshot: Snapshot, cfg: Config): Scenario[] {
  const rows: Scenario[] = [];
  for (const path of [...snapshot.keys()].sort()) {
    if (!path.endsWith('.feature') || !under(path, cfg.feature_roots)) continue;
    const blob = snapshot.get(path)!;
    if (!['100644', '100755'].includes(blob.mode)) throw new IntentError('Gherkin specifications must be regular files: ' + path);
    rows.push(...scenarios(path, blob.data));
  }
  return rows;
}
export function protectedContract(snapshot: Snapshot, cfg: Config): { cases: Scenario[]; features: Set<string>; glue: Set<string> } {
  const cases = catalogue(snapshot, cfg), features = new Set(cases.filter(s => s.intent).map(s => s.path));
  const glue = new Set([...snapshot.keys()].filter(p => features.size && under(p, cfg.glue_roots)));
  if (features.size && !glue.size) throw new IntentError('Intent exists but no glue files were found. Configure glue_roots; refusing an unprotected contract.');
  for (const p of glue) if (!['100644', '100755'].includes(snapshot.get(p)!.mode)) throw new IntentError('Glue must be regular files, not symlinks/submodules: ' + p);
  return { cases, features, glue };
}
export function sameRevision(a: Revision, b: Revision): boolean { return a.head === b.head && a.tree === b.tree; }
export function report(repo: Repository): Review {
  const revision = repo.revision(), base = repo.snapshot('HEAD'), candidate = repo.snapshot('INDEX');
  const oldCfg = config(base), newCfg = config(candidate);
  const old = protectedContract(base, oldCfg), next = protectedContract(candidate, newCfg);
  const featureScope = new Set([...old.features, ...next.features]);
  const roots = [...new Set([...oldCfg.glue_roots, ...newCfg.glue_roots])].sort();
  const allPaths = [...new Set([...base.keys(), ...candidate.keys()])].sort();
  const glueScope = new Set(allPaths.filter(p => featureScope.size && under(p, roots)));
  const controls = [...new Set([...MANDATORY_CONTROLS, ...oldCfg.control_paths, ...newCfg.control_paths])];
  const scope = new Set([...featureScope, ...glueScope, ...allPaths.filter(p => under(p, controls))]);
  const changes: ProtectedChange[] = [];
  for (const path of [...scope].sort()) {
    const before = base.get(path), after = candidate.get(path);
    if ((!before && !after) || before?.equals(after)) continue;
    changes.push({ path, category: featureScope.has(path) ? 'specification' : glueScope.has(path) ? 'glue/support' : 'verification controls',
      change: !before ? 'added' : !after ? 'deleted' : 'modified', before: before?.digest || null, after: after?.digest || null });
  }
  if (!sameRevision(repo.revision(), revision)) throw new IntentError('Index changed during verification; retry');
  return { revision, changes, requiresApproval: !!changes.length, approved: hasApproval(repo, revision), glueRoots: roots,
    protectedFeatures: [...featureScope].sort(), protectedGlue: [...glueScope].sort(),
    protectionMode: 'whole-feature-and-complete-glue-pool', intentScenarios: next.cases.filter(s => s.intent).length };
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (object(value)) return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
function key(repo: Repository, create = false): Buffer {
  const file = join(repo.stateDir, 'review.key');
  if (create) {
    mkdirSync(repo.stateDir, { recursive: true, mode: 0o700 });
    let fd: number | undefined;
    try { fd = openSync(file, 'wx', 0o600); writeFileSync(fd, randomBytes(32)); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
    finally { if (fd !== undefined) closeSync(fd); }
  }
  return readFileSync(file);
}
function signature(repo: Repository, payload: unknown, create = false): string {
  return createHmac('sha256', key(repo, create)).update(canonical(payload)).digest('hex');
}
export function hasApproval(repo: Repository, revision: Revision): boolean {
  try {
    const record: unknown = JSON.parse(readFileSync(join(repo.stateDir, 'approval.json'), 'utf8'));
    if (!object(record) || !object(record.payload) || typeof record.signature !== 'string') return false;
    const payload = record.payload;
    if (payload.version !== 2 || !validRevision(payload.revision) || !sameRevision(payload.revision, revision)
      || typeof payload.reviewer !== 'string' || !payload.reviewer.trim() || typeof payload.reason !== 'string' || !payload.reason.trim()) return false;
    const actual = Buffer.from(signature(repo, payload)), supplied = Buffer.from(record.signature);
    return actual.length === supplied.length && timingSafeEqual(actual, supplied);
  } catch { return false; }
}
export function validRevision(value: unknown): value is Revision {
  return object(value) && typeof value.head === 'string' && /^(UNBORN|[0-9a-f]{40,64})$/.test(value.head)
    && typeof value.tree === 'string' && /^[0-9a-f]{40,64}$/.test(value.tree);
}
export function approve(repo: Repository, input: ApprovalRequest): ApprovalPayload {
  if (input.acknowledgement !== 'APPROVE INTENT CHANGE') throw new IntentError('Type APPROVE INTENT CHANGE to explicitly approve this revision');
  if (!input.reviewer.trim() || !input.reason.trim()) throw new IntentError('Reviewer name and rationale are required');
  const current = report(repo);
  if (!sameRevision(current.revision, input.revision)) throw new IntentError('Staged revision changed after review; refresh and review the new diff');
  if (!current.requiresApproval) throw new IntentError('No protected change needs approval');
  const payload: ApprovalPayload = { version: 2, revision: input.revision, reviewer: input.reviewer.trim(), reason: input.reason.trim(),
    at: new Date().toISOString(), changes: current.changes };
  const record = { payload, signature: signature(repo, payload, true) }, output = join(repo.stateDir, 'approval.json');
  const temp = mkdtempSync(join(repo.stateDir, 'approval-'));
  try { const file = join(temp, 'record'); writeFileSync(file, JSON.stringify(record, null, 2), { mode: 0o600 }); renameSync(file, output); }
  finally { rmSync(temp, { recursive: true, force: true }); }
  if (!sameRevision(repo.revision(), input.revision)) { unlinkSync(output); throw new IntentError('Index changed while approving; review again'); }
  return payload;
}
export function verify(repo: Repository): Review {
  const value = report(repo);
  if (value.requiresApproval && !value.approved) throw new IntentError('Human approval required for staged intent/glue/control changes: '
    + value.changes.map(c => c.path).join(', ') + '. Open the local review UI; do not regenerate a baseline to bypass review.');
  return value;
}
