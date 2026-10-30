import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function isProjectService(root: string, cwd: string, command: string): boolean {
  return root === cwd && /(?:^|\s)(?:\S*\/)?runtime\/cli\.cjs\s+serve(?:\s|$)/.test(command);
}

function stop(args: string[]): void {
  if (args.length && (args.length !== 2 || args[0] !== '--port')) throw Error('Usage: npm stop -- [--port PORT]');
  const port = args[1] ?? '8765';
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) throw Error('Invalid port');
  const root = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
  let listeners: string;
  try {
    listeners = execFileSync('lsof', ['-nP', '-t', `-iTCP:${port}`, '-sTCP:LISTEN'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    if (failure.status === 1 && !failure.stdout && !failure.stderr) { console.log(`No service is listening on port ${port}.`); return; }
    throw error;
  }
  const pids = [...new Set(listeners.trim().split(/\s+/))];
  for (const pid of pids) {
    if (!/^\d+$/.test(pid)) throw Error('Invalid listener PID');
    const cwd = execFileSync('lsof', ['-a', '-p', pid, '-d', 'cwd', '-Fn'], { encoding: 'utf8' })
      .split('\n').find(line => line.startsWith('n'))?.slice(1) ?? '';
    const command = execFileSync('ps', ['-p', pid, '-o', 'args='], { encoding: 'utf8' }).trim();
    if (!isProjectService(root, cwd, command)) throw Error(`Refusing to stop PID ${pid}: not this project's Agent Intent service.`);
  }
  for (const pid of pids) {
    process.kill(Number(pid), 'SIGTERM');
    console.log(`Sent SIGTERM to Agent Intent PID ${pid} on port ${port}.`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { stop(process.argv.slice(2)); }
  catch (error) { console.error('Agent Intent stop: ' + (error instanceof Error ? error.message : String(error))); process.exitCode = 1; }
}
