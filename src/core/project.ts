import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { hasSymlinkParent, IntentError, object, safePath } from './files.js';
import type { Config } from './types.js';

export function config(root: string): Config {
  const path = join(root, '.agent-intent.json');
  if (!existsSync(path)) return { version: 1, feature_roots: ['features'] };
  if (hasSymlinkParent(root, path) || !lstatSync(path).isFile()) throw new IntentError('Configuration must be a regular file');
  let value: unknown;
  try { value = JSON.parse(readFileSync(path, 'utf8')); }
  catch { throw new IntentError('Invalid .agent-intent.json: expected JSON'); }
  if (!object(value) || value.version !== 1 || !Array.isArray(value.feature_roots) || !value.feature_roots.length) {
    throw new IntentError('Invalid .agent-intent.json: version 1 and nonempty feature_roots required');
  }
  const checks = value.checks;
  if (checks !== undefined && (!Array.isArray(checks) || !checks.length || checks.some(command =>
    !Array.isArray(command) || !command.length || typeof command[0] !== 'string' || !command[0].length || command.some(arg => typeof arg !== 'string' || arg.includes('\0'))))) {
    throw new IntentError('Invalid checks: expected a nonempty array of nonempty command argument arrays');
  }
  const template = value.editor_url_template;
  if (template !== undefined && (typeof template !== 'string'
    || !/^[a-z][a-z0-9+.-]*:\/\//i.test(template) || /^(javascript|data|vbscript):/i.test(template)
    || /[\x00-\x20]/.test(template) || !/\{(?:path|encodedPath)\}/.test(template)
    || !template.includes('{line}') || /[{}]/.test(template.replace(/\{(?:path|encodedPath|line|column)\}/g, '')))) {
    throw new IntentError('Invalid editor_url_template: use an IDE URL with {path} or {encodedPath} and {line}');
  }
  return { version: 1, feature_roots: [...new Set(value.feature_roots.map(safePath))],
    ...(checks !== undefined ? { checks: checks as string[][] } : {}),
    ...(typeof template === 'string' ? {editor_url_template: template} : {}) };
}
