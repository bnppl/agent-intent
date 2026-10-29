import { AstBuilder, GherkinClassicTokenMatcher, Parser } from '@cucumber/gherkin';
import { createHash } from 'node:crypto';
import { chmodSync, lstatSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { decode, hasSymlinkParent, IntentError, Repository, safePath, under } from './repository.js';
import type { AnnotationRequest, Scenario } from './types.js';

export function sha256(data: Uint8Array): string { return createHash('sha256').update(data).digest('hex'); }
export function scenarios(path: string, data: Buffer): Scenario[] {
  const source = decode(data);
  let document;
  try { let id = 0; document = new Parser(new AstBuilder(() => String(++id)), new GherkinClassicTokenMatcher()).parse(source); }
  catch (error) { throw new IntentError(`Gherkin parse error in ${path}: ${String(error)}`); }
  const feature = document.feature;
  if (!feature) throw new IntentError('Gherkin feature is missing in ' + path);
  const output: Scenario[] = [];
  type Tag = { name: string; location: { line: number; column?: number } };
  type AstNode = { tags: readonly Tag[]; children: readonly { rule?: AstNode; scenario?: {
    name: string; keyword: string; location: { line: number }; tags: readonly Tag[];
    examples: readonly { tags: readonly Tag[] }[];
  } }[] };
  function walk(node: AstNode, inherited: readonly Tag[]): void {
    const effective = [...inherited, ...node.tags];
    for (const child of node.children) {
      if (child.rule) walk(child.rule, effective);
      if (!child.scenario) continue;
      const s = child.scenario, direct = s.tags, tags = [...effective, ...direct];
      const exampleTags = s.examples.flatMap(e => [...e.tags]);
      output.push({ id: `${path}:${s.location.line}`, path, line: s.location.line, name: s.name, keyword: s.keyword,
        intent: [...tags, ...exampleTags].some(t => t.name === '@intent'),
        directIntent: direct.some(t => t.name === '@intent'),
        inheritedIntent: [...effective, ...exampleTags].some(t => t.name === '@intent'),
        tags: tags.map(t => t.name), sourceHash: sha256(data), source,
        tagLocations: direct.filter(t => t.name === '@intent').map(t => ({ line: t.location.line, column: t.location.column ?? 1 })) });
    }
  }
  walk(feature, []);
  return output;
}
export function annotate(repo: Repository, request: AnnotationRequest, featureRoots: string[]): void {
  const path = safePath(request.path), { line, enabled, sourceHash } = request;
  if (!under(path, featureRoots) || !path.endsWith('.feature')) throw new IntentError('Only configured Gherkin feature files can be annotated');
  const full = join(repo.root, path);
  if (lstatSync(full).isSymbolicLink() || hasSymlinkParent(repo.root, full)) throw new IntentError('Refusing to annotate a symlink');
  const data = readFileSync(full);
  if (sha256(data) !== sourceHash) throw new IntentError('File changed since the view was opened; reload before annotating');
  const scenario = scenarios(path, data).find(s => s.line === line);
  if (!scenario) throw new IntentError('Scenario no longer exists; reload the view');
  if (!enabled && scenario.inheritedIntent) throw new IntentError('Intent is inherited from Feature, Rule, or Examples; edit those tags explicitly for review');
  if (enabled === scenario.directIntent) return;
  const source = decode(data), lines = source.match(/[^\n]*\n|[^\n]+$/g) || [];
  if (enabled) {
    const indent = lines[line - 1].match(/^\s*/)?.[0] || '';
    lines.splice(line - 1, 0, indent + '@intent' + (source.includes('\r\n') ? '\r\n' : '\n'));
  } else {
    for (const loc of [...scenario.tagLocations].sort((a, b) => b.line - a.line || b.column - a.column)) {
      const index = loc.line - 1;
      // Gherkin locations count Unicode code points, not JavaScript UTF-16 units.
      const chars = [...lines[index]], col = loc.column - 1;
      if (chars.slice(col, col + 7).join('') !== '@intent') throw new IntentError('Tag position changed; reload');
      chars.splice(col, 7);
      const changed = chars.join(''); lines[index] = changed.trim() ? changed : '';
    }
  }
  const output = Buffer.from(lines.join(''));
  scenarios(path, output);
  if (!readFileSync(full).equals(data)) throw new IntentError('Concurrent modification; reload');
  const temporaryDir = mkdtempSync(join(dirname(full), '.intent-dd-write-'));
  try {
    const temporary = join(temporaryDir, 'feature');
    writeFileSync(temporary, output); chmodSync(temporary, lstatSync(full).mode & 0o777); renameSync(temporary, full);
  } finally { rmSync(temporaryDir, { recursive: true, force: true }); }
}
