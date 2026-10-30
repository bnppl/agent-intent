#!/usr/bin/env node
import { resolve } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import { IntentError } from './core/files.js';
import { serve } from './server.js';
import { reportModel, verifyReport } from './lineage/state.js';
import { workingScenarios } from './lineage/load.js';
import { definitionText } from './lineage/definition.js';
import { createReview, importApprovals } from './lineage/review.js';
import { renderStaticReview } from './lineage/static-review.js';

async function main(argv: string[]): Promise<number> {
  let root = '.', port = 8765, command: string | undefined, output: string | undefined, inputFile: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--root') { if (!argv[i + 1]) throw new IntentError('--root requires a path'); root = argv[++i]; }
    else if (arg === '--port') { port = Number(argv[++i]); if (!Number.isInteger(port) || port < 0 || port > 65535) throw new IntentError('Invalid --port'); }
    else if (arg === '--output' || arg === '--file') {
      const value = argv[++i]; if (!value || value.startsWith('--')) throw new IntentError(arg + ' requires a path');
      if (arg === '--output') output = value; else inputFile = value;
    }
    else if (arg === '--help' || arg === '-h') { console.log('Intent DD\nUsage: intent-dd [--root PATH] <serve [--port PORT] | verify | status | spec | review [--output PREFIX] | approve [--file PATH]>\nReview writes PREFIX.html and PREFIX.txt (default: intentdd-review). Approve reads exact approval envelopes from a file or stdin.'); return 0; }
    else if (!command && ['serve', 'verify', 'status', 'spec', 'review', 'approve'].includes(arg)) command = arg;
    else throw new IntentError('Unknown argument: ' + arg);
  }
  if (!command) throw new IntentError('Choose serve, verify, status, spec, review, or approve (--help for usage)');
  if (output !== undefined && command !== 'review') throw new IntentError('--output is only valid with review');
  if (inputFile !== undefined && command !== 'approve') throw new IntentError('--file is only valid with approve');
  root = resolve(root);
  if (command === 'review') {
    const files = renderStaticReview(createReview(root)), prefix = resolve(output ?? 'intentdd-review');
    writeFileSync(prefix + '.html', files.html, { flag: 'wx' });
    writeFileSync(prefix + '.txt', files.text, { flag: 'wx' });
    console.log('Review files: ' + prefix + '.html and ' + prefix + '.txt. No specifications accepted.');
  } else if (command === 'approve') {
    if (!inputFile && process.stdin.isTTY) throw new IntentError('Pipe pasted approval text to stdin or supply --file PATH');
    const count = importApprovals(root, readFileSync(inputFile ? resolve(inputFile) : 0, 'utf8'));
    console.log('Accepted ' + count + ' selected specification change(s). Other changes remain pending; run verify.');
  } else if (command === 'serve') await serve(root, port);
  else if (command === 'status') console.log(JSON.stringify(reportModel(root), null, 2));
  else if (command === 'verify') {
    verifyReport(root);
    console.log('Intent DD: report specifications match the accepted lock and no tests failed.');
  } else {
    console.log('# Project specifications\n');
    for (const scenario of workingScenarios(root)) console.log('## ' + scenario.path + '\n\n' + definitionText(scenario.definition) + '\n');
  }
  return 0;
}
void main(process.argv.slice(2)).then(code => { process.exitCode = code; }).catch((error: unknown) => {
  console.error('Intent DD: ' + (error instanceof Error ? error.message : String(error))); process.exitCode = 1;
});
