import { AstBuilder, GherkinClassicTokenMatcher, Parser } from '@cucumber/gherkin';
import { createHash } from 'node:crypto';
import { decode, IntentError } from './files.js';
import type { Scenario } from './types.js';

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
      output.push({ id: `${path}:${s.location.line}`, path, line: s.location.line, name: s.name, keyword: s.keyword,
        tags: tags.map(t => t.name) });
    }
  }
  walk(feature, []);
  return output;
}
