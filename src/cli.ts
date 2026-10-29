#!/usr/bin/env node
import { resolve } from 'node:path';
import { Repository, IntentError } from './core/repository.js';
import { config, protectedContract, report, verify } from './core/verification.js';
import { installHook } from './hook.js';
import { serve } from './server.js';

async function main(argv: string[]): Promise<number> {
  let root = '.', port = 8765, command: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--repo') { if (!argv[i + 1]) throw new IntentError('--repo requires a path'); root = argv[++i]; }
    else if (arg === '--port') { port = Number(argv[++i]); if (!Number.isInteger(port) || port < 0 || port > 65535) throw new IntentError('Invalid --port'); }
    else if (arg === '--help' || arg === '-h') { console.log('Intent DD\nUsage: intent-dd [--repo PATH] <serve [--port PORT] | verify | status | install-hook | spec>'); return 0; }
    else if (!command && ['serve', 'verify', 'status', 'install-hook', 'spec'].includes(arg)) command = arg;
    else throw new IntentError('Unknown argument: ' + arg);
  }
  if (!command) throw new IntentError('Choose serve, verify, status, install-hook, or spec (--help for usage)');
  const repo = new Repository(resolve(root));
  if (command === 'serve') await serve(repo.root, port);
  else if (command === 'install-hook') console.log('Installed pre-commit hook: ' + installHook(repo));
  else if (command === 'status') console.log(JSON.stringify(report(repo), null, 2));
  else if (command === 'verify') {
    const value = verify(repo);
    console.log(value.requiresApproval ? 'Intent DD: staged revision is explicitly approved.' : 'Intent DD: no protected changes in the index.');
  } else {
    const snapshot = repo.snapshot('HEAD'), cfg = config(snapshot), { features } = protectedContract(snapshot, cfg);
    console.log('# Repository intent\n\nRead this executable contract before implementing. Change intent only through explicit human review.\n');
    console.log('Glue boundary: ' + cfg.glue_roots.join(', ') + '\n');
    for (const path of [...features].sort()) console.log('## ' + path + '\n\n~~~~gherkin\n' + snapshot.get(path)!.data.toString('utf8') + '\n~~~~\n');
    console.log('Run the acceptance suite. Observe failures before implementation. Never remove tags, skip steps, weaken assertions, or approve your own changes.');
  }
  return 0;
}
void main(process.argv.slice(2)).then(code => { process.exitCode = code; }).catch((error: unknown) => {
  console.error('Intent DD: ' + (error instanceof Error ? error.message : String(error))); process.exitCode = 1;
});
