import { parse } from '@babel/parser';
import { lstatSync, readFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hasSymlinkParent } from '../core/files.js';

export interface TestSource { path: string; line: number; code: string }
interface Location { file?: string; line?: number; column?: number; name?: string }
interface Span { start: number; end: number; line: number; name?: string }

/** Use runner declaration locations, never test-name searches or brace counting. */
export function sourceReader(root: string): (location: Location) => TestSource | undefined {
  const cache = new Map<string, { text: string; spans: Span[] } | undefined>();
  return ({ file, line, column, name }) => {
    if (!file || !line || !column) return undefined;
    try {
      const full = file.startsWith('file:') ? fileURLToPath(file) : resolve(root, file);
      const path = relative(root, full);
      if (!path || isAbsolute(path) || path === '..' || path.startsWith('../')
        || hasSymlinkParent(root, full) || !lstatSync(full).isFile()) return undefined;
      if (!cache.has(full)) {
        cache.set(full, undefined);
        const text = readFileSync(full, 'utf8');
        const ast = parse(text, { sourceType: 'unambiguous', plugins: /\.[jt]sx$/.test(full) ? ['typescript', 'jsx'] : ['typescript'] });
        const spans: Span[] = [];
        function visit(value: unknown): void {
          if (!value || typeof value !== 'object') return;
          if (Array.isArray(value)) { value.forEach(visit); return; }
          const node = value as { type?: string; start?: number; end?: number; loc?: { start: { line: number } }; arguments?: {type: string; value?: string}[] };
          if (node.type === 'CallExpression' && node.start !== undefined && node.end !== undefined && node.loc) {
            spans.push({ start: node.start, end: node.end, line: node.loc.start.line, name: node.arguments?.[0]?.type === 'StringLiteral' ? node.arguments[0].value : undefined });
          }
          for (const [key, child] of Object.entries(value)) if (!['loc', 'tokens', 'comments'].includes(key)) visit(child);
        }
        visit(ast.program);
        cache.set(full, { text, spans });
      }
      const source = cache.get(full);
      if (!source) return undefined;
      const lines = source.text.split('\n');
      if (line > lines.length) return undefined;
      const offset = lines.slice(0, line - 1).reduce((sum, value) => sum + value.length + 1, 0) + column - 1;
      const span = source.spans.find(span => span.start === offset && (!name || !span.name || span.name === name));
      if (!span) return undefined;
      return { path: path.split('\\').join('/'), line: span.line, code: source.text.slice(span.start, span.end) };
    } catch { return undefined; } // Missing or unsupported source must not hide test outcomes.
  };
}
