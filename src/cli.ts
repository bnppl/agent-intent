#!/usr/bin/env node
import { resolve } from 'node:path';
import { IntentError } from './core/files.js';
import { serve } from './server.js';
import { reportModel, verifyReport } from './lineage/state.js';
import { workingScenarios } from './lineage/load.js';
import { definitionText } from './lineage/definition.js';

async function main(argv: string[]): Promise<number> {
  let root = '.', port = 8765, command: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--root') { if (!argv[i + 1]) throw new IntentError('--root requires a path'); root = argv[++i]; }
    else if (arg === '--port') { port = Number(argv[++i]); if (!Number.isInteger(port) || port < 0 || port > 65535) throw new IntentError('Invalid --port'); }
    else if (arg === '--help' || arg === '-h') { console.log('Intent DD\nUsage: intent-dd [--root PATH] <serve [--port PORT] | verify | status | spec>'); return 0; }
    else if (!command && ['serve', 'verify', 'status', 'spec'].includes(arg)) command = arg;
    else throw new IntentError('Unknown argument: ' + arg);
  }
  if (!command) throw new IntentError('Choose serve, verify, status, or spec (--help for usage)');
  root = resolve(root);
  if (command === 'serve') await serve(root, port);
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
