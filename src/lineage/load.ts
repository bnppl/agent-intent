import { AstBuilder, GherkinClassicTokenMatcher, Parser } from '@cucumber/gherkin';
import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { IntentError, hasSymlinkParent } from '../core/files.js';
import { config } from '../core/project.js';
import { scenarios } from '../core/gherkin.js';
import { sha256 } from '../core/gherkin.js';
import type { StoredScenario } from './state.js';

/** Source positions and parser-generated IDs do not change a specification's meaning. */
function meaning(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(meaning);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([key]) => key !== 'id' && key !== 'location').map(([key, child]) => [key, meaning(child)]));
  return value;
}

type Container = { name: string; children: readonly {
  background?: unknown; rule?: Container;
  scenario?: { name: string; location: { line: number } };
}[] };

export function workingScenarios(root: string): StoredScenario[] {
  const snapshot = new Map<string, Buffer>();
  const cfg = config(root);
  function visit(path: string): void {
    const full = join(root, path), stat = lstatSync(full);
    if (hasSymlinkParent(root, full) || stat.isSymbolicLink()) throw new IntentError('Feature roots must not contain symlinks: ' + path);
    if (stat.isDirectory()) for (const child of readdirSync(full).sort()) visit(path + '/' + child);
    else if (stat.isFile() && path.endsWith('.feature')) snapshot.set(path, readFileSync(full));
  }
  for (const path of cfg.feature_roots) visit(path);
  const rows = [...snapshot.entries()].sort(([a], [b]) => a.localeCompare(b)).flatMap(([path, data]) => scenarios(path, data));
  const output: StoredScenario[] = [];
  for (const path of [...new Set(rows.map(row => row.path))]) {
    let id = 0;
    const document = new Parser(new AstBuilder(() => String(++id)), new GherkinClassicTokenMatcher())
      .parse(snapshot.get(path)!.toString('utf8'));
    const occurrences = new Map<string, number>();
    function walk(node: Container, parents: unknown[], ruleNames: string[]): void {
      const { children, ...metadata } = node;
      const context = meaning({ ...metadata, backgrounds: children.filter(child => child.background).map(child => child.background) });
      for (const child of children) {
        if (child.rule) walk(child.rule, [...parents, context], [...ruleNames, child.rule.name]);
        if (!child.scenario) continue;
        const scenario = child.scenario;
        const row = rows.find(row => row.path === path && row.line === scenario.location.line)!;
        const identity = JSON.stringify([path, ...ruleNames, scenario.name]);
        const occurrence = occurrences.get(identity) ?? 0; occurrences.set(identity, occurrence + 1);
        const definition = JSON.stringify({ contexts: [...parents, context], scenario: meaning(scenario) });
        output.push({ id: row.id, path, name: row.name, tags: row.tags,
          key: identity + ':' + occurrence, definition, fingerprint: sha256(Buffer.from(definition)) });
      }
    }
    if (document.feature) walk(document.feature, [], []);
  }
  return output;
}
