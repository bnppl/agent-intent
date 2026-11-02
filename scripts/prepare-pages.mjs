import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, '.pages-source');
rmSync(output, { recursive: true, force: true });
mkdirSync(resolve(output, 'assets'), { recursive: true });
copyFileSync(resolve(root, 'assets/agent-intent-logo.png'), resolve(output, 'assets/agent-intent-logo.png'));
writeFileSync(resolve(output, 'index.md'), '---\nlayout: default\ntitle: Agent Intent\n---\n\n' + readFileSync(resolve(root, 'README.md'), 'utf8'));
writeFileSync(resolve(output, '_config.yml'), 'title: Agent Intent\ndescription: Executable specifications, BDD test lineage, and human specification acceptance\ntheme: jekyll-theme-primer\n');
console.log('Prepared GitHub Pages documentation in .pages-source/');
