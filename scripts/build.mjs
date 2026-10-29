import { build } from 'esbuild';
import { readFileSync, mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const notices = ['@cucumber/gherkin', '@cucumber/messages'].map(name => {
  const base = resolve(root, 'node_modules', name);
  const pkg = JSON.parse(readFileSync(resolve(base, 'package.json'), 'utf8'));
  return name + ' ' + pkg.version + '\n' + readFileSync(resolve(base, 'LICENSE'), 'utf8');
}).join('\n\n');
const browser = await build({ absWorkingDir: root, entryPoints: ['src/web/app.ts'], bundle: true, platform: 'browser',
  format: 'iife', target: 'es2022', write: false, legalComments: 'inline' });
const assets = { html: readFileSync(resolve(root, 'src/web/index.html'), 'utf8'), css: readFileSync(resolve(root, 'src/web/style.css'), 'utf8'), js: browser.outputFiles[0].text };
const result = await build({ absWorkingDir: root, entryPoints: ['src/cli.ts'], bundle: true, platform: 'node', format: 'cjs',
  target: 'node24', write: false, legalComments: 'inline', minify: true,
  footer: { js: '/* Bundled third-party notices\n' + notices.replaceAll('*/', '* /') + '\n*/' },
  plugins: [{ name: 'embedded-ui', setup(api) {
    api.onResolve({ filter: /^intentdd:assets$/ }, () => ({ path: 'assets', namespace: 'intentdd' }));
    api.onLoad({ filter: /.*/, namespace: 'intentdd' }, () => ({ contents: Object.entries(assets).map(([key, value]) => `export const ${key} = ${JSON.stringify(value)};`).join('\n'), loader: 'js' }));
  } }] });
const output = resolve(root, 'runtime/cli.cjs'), content = result.outputFiles[0].contents;
if (process.argv.includes('--check')) {
  let existing; try { existing = readFileSync(output); } catch { /* handled below */ }
  if (!existing || !existing.equals(Buffer.from(content))) { console.error('runtime/cli.cjs is stale. Run npm run build and review the bundle change.'); process.exitCode = 1; }
  else console.log('Committed runtime bundle matches TypeScript and web source.');
} else { mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, content); chmodSync(output, 0o755); console.log('Built runtime/cli.cjs'); }
