import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { safePath } from './files.js';
import { config } from './project.js';

export interface EditorOptions { root: string; urlTemplate: string }
export function editorOptions(root: string): EditorOptions {
  return { root: resolve(root), urlTemplate: config(root).editor_url_template ?? 'vscode://file{path}:{line}:{column}' };
}
export function editorLink(path: string, line: number, editor?: EditorOptions): string | undefined {
  if (!editor || !Number.isSafeInteger(line) || line < 1) return undefined;
  try {
    const full = resolve(editor.root, safePath(path));
    const values: Record<string, string> = { path: pathToFileURL(full).pathname,
      encodedPath: encodeURIComponent(full), line: String(line), column: '1' };
    return editor.urlTemplate.replace(/\{(path|encodedPath|line|column)\}/g, (_, key: string) => values[key]);
  } catch { return undefined; }
}
