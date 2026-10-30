import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { hasSymlinkParent, IntentError, object, safePath } from './files.js';
import type { Config } from './types.js';

export function config(root: string): Config {
  const path = join(root, '.intentdd.json');
  if (!existsSync(path)) return { version: 1, feature_roots: ['features'] };
  if (hasSymlinkParent(root, path) || !lstatSync(path).isFile()) throw new IntentError('Configuration must be a regular file');
  let value: unknown;
  try { value = JSON.parse(readFileSync(path, 'utf8')); }
  catch { throw new IntentError('Invalid .intentdd.json: expected JSON'); }
  if (!object(value) || value.version !== 1 || !Array.isArray(value.feature_roots) || !value.feature_roots.length) {
    throw new IntentError('Invalid .intentdd.json: version 1 and nonempty feature_roots required');
  }
  const template = value.editor_url_template;
  if (template !== undefined && (typeof template !== 'string'
    || !/^[a-z][a-z0-9+.-]*:\/\//i.test(template) || /^(javascript|data|vbscript):/i.test(template)
    || /[\x00-\x20]/.test(template) || !/\{(?:path|encodedPath)\}/.test(template)
    || !template.includes('{line}') || /[{}]/.test(template.replace(/\{(?:path|encodedPath|line|column)\}/g, '')))) {
    throw new IntentError('Invalid editor_url_template: use an IDE URL with {path} or {encodedPath} and {line}');
  }
  return { version: 1, feature_roots: [...new Set(value.feature_roots.map(safePath))],
    ...(typeof template === 'string' ? {editor_url_template: template} : {}) };
}
