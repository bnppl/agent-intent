import { spawn, execFileSync } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from './core/project.js';
import { IntentError, hasSymlinkParent } from './core/files.js';
import { reportModel } from './lineage/state.js';
import { workingScenarios } from './lineage/load.js';

export async function runChecks(commands: string[][], run: (command: string[]) => Promise<void>): Promise<void> {
  for (const command of commands) await run(command);
}

export async function runProject(root: string): Promise<void> {
  const commands = config(root).checks;
  if (!commands?.length) throw new IntentError('Configure checks in .agent-intent.json as a nonempty array of command argument arrays; include a lineage-reporting test command.');
  const path = resolve(root, '.agent-intent/lineage/latest.json');
  const before = existsSync(path) ? statSync(path, { bigint: true }).mtimeNs : undefined;
  await runChecks(commands, command => new Promise<void>((done, reject) => {
    console.log('Running: ' + command.join(' '));
    const child = spawn(command[0], command.slice(1), { cwd: root, stdio: 'inherit', shell: false });
    child.once('error', reject);
    child.once('exit', (code, signal) => code === 0 ? done() : reject(new IntentError(`Check failed (${signal ?? code}): ${command.join(' ')}`)));
  }));
  if (!existsSync(path) || statSync(path, { bigint: true }).mtimeNs === before) throw new IntentError('Checks did not generate a fresh lineage report. Configure a reporting test command.');
  const { snapshot } = reportModel(root), current = workingScenarios(root);
  if (snapshot.runFailed || snapshot.tests.some(test => test.status === 'failed')) throw new IntentError('Tests failed in the latest report');
  const reported = new Map(snapshot.scenarios.map(s => [s.key, s.fingerprint]));
  if (current.length !== reported.size || current.some(s => reported.get(s.key) !== s.fingerprint)) throw new IntentError('Specifications changed since the report; rerun checks');
  console.log('Checks complete. Specification acceptance is unchanged.');
}

export function isProjectService(root: string, cwd: string, command: string): boolean {
  return root === cwd && /(?:^|\s)\S*cli\.cjs\s+serve(?:\s|$)/.test(command);
}

// Inspect both command and working directory before signalling any listener.
export function service(root: string, port: number): { pid: number; url: string } | null {
  let listeners: string;
  try { listeners = execFileSync('lsof', ['-nP', '-t', `-iTCP:${port}`, '-sTCP:LISTEN'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch (error) {
    const e = error as { status?: number; stdout?: string; stderr?: string };
    if (e.status === 1 && !e.stdout && !e.stderr) return null;
    throw new IntentError('Server management requires lsof and ps (macOS/Linux).');
  }
  const pids = [...new Set(listeners.trim().split(/\s+/))];
  if (pids.length !== 1 || !/^\d+$/.test(pids[0])) throw new IntentError(`Port ${port} has unexpected listeners`);
  const pid = pids[0];
  const cwd = execFileSync('lsof', ['-a', '-p', pid, '-d', 'cwd', '-Fn'], { encoding: 'utf8' }).split('\n').find(line => line.startsWith('n'))?.slice(1);
  const command = execFileSync('ps', ['-p', pid, '-o', 'args='], { encoding: 'utf8' }).trim();
  if (!isProjectService(realpathSync(root), cwd ?? '', command)) throw new IntentError(`Port ${port} belongs to another process or project; refusing to manage it.`);
  return { pid: Number(pid), url: `http://127.0.0.1:${port}` };
}

export function stopProject(root: string, port: number): void {
  const running = service(root, port);
  if (!running) { console.log(`No server listening on port ${port}.`); return; }
  process.kill(running.pid, 'SIGTERM');
  console.log(`Stopped Agent Intent PID ${running.pid} on port ${port}.`);
}

export async function startProject(root: string, port: number): Promise<void> {
  // Check ownership before expensive checks, but never skip refreshing evidence.
  const running = service(root, port);
  await runProject(root);
  if (running && service(root, port)?.pid === running.pid) {
    console.log(`Agent Intent: ${running.url} (already running, PID ${running.pid}; evidence refreshed)`); return;
  }
  const log = resolve(root, `.agent-intent/server-${port}.log`);
  if (hasSymlinkParent(root, log)) throw new IntentError('Server log must not use symlinks');
  mkdirSync(resolve(root, '.agent-intent'), { recursive: true });
  const fd = openSync(log, 'a');
  const child = spawn(process.execPath, [resolve(process.argv[1]), 'serve', '--root', root, '--port', String(port)], {
    cwd: root, detached: true, stdio: ['ignore', fd, fd, 'ipc'],
  });
  closeSync(fd);
  try {
    await new Promise<void>((done, reject) => {
      const timeout = setTimeout(() => { reject(new IntentError(`Server startup timed out. See ${log}`)); }, 10000);
      const finish = (error?: Error) => { clearTimeout(timeout); error ? reject(error) : done(); };
      child.once('error', error => finish(error));
      child.once('exit', code => finish(new IntentError(`Server exited (${code}). See ${log}\n${readFileSync(log, 'utf8').slice(-2000)}`)));
      child.once('message', message => message === 'agent-intent:ready' ? finish() : finish(new IntentError('Unexpected server readiness message')));
    });
    child.disconnect(); child.unref();
    console.log(`Agent Intent: http://127.0.0.1:${port}\nRunning in background (PID ${child.pid}). Log: ${log}\nStop: npx agent-intent stop --port ${port}`);
  } catch (error) { child.kill(); throw error; }
}
