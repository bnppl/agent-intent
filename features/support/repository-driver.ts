/** Protocol driver: real Git trees, the bundled CLI, and real loopback HTTP. */
import { spawn, spawnSync } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { request as httpRequest } from 'node:http';
import { once } from 'node:events';
import { Repository } from '../../src/core/repository.js';
import type { Revision, Scenario, Workspace } from '../../src/core/types.js';

export const PROJECT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const BUNDLE = join(PROJECT, 'runtime/cli.cjs');
export const FEATURE = 'features/example.feature';
export const GLUE = 'features/steps/example-steps.ts';
export const SUPPORT = 'features/support/assertions.ts';
export interface Response { status: number; body: string }
export class RepositoryDriver {
  readonly root = mkdtempSync(join(tmpdir(), 'intent-dd-spec-'));
  readonly repo: Repository;
  server?: ChildProcess;
  port?: number;
  token?: string;
  annotationHead?: string;
  constructor(marked = true) {
    this.git(['init', '-q']); this.git(['config', 'user.name', 'Acceptance test']); this.git(['config', 'user.email', 'test@example.invalid']);
    this.write('.intentdd.json', JSON.stringify({ version: 1, feature_roots: ['features'], glue_roots: ['features/steps', 'features/support', 'features/hooks.ts'], control_paths: ['src', 'runtime', '.intentdd.json'] }));
    this.write(FEATURE, 'Feature: Booking\n\n' + (marked ? '  @intent\n' : '') + '  Scenario: Preserve a booking\n    Given a booking exists\n    Then the booking is preserved\n');
    this.write(GLUE, 'import { Given, Then } from "@cucumber/cucumber";\nGiven("a booking exists", function () { this.booking = true; });\nThen("the booking is preserved", function () { if (!this.booking) throw Error("Missing booking"); });\n');
    this.write(SUPPORT, 'export function assertPreserved(value: boolean) { if (!value) throw Error("Missing booking"); }\n');
    this.write('application.ts', 'export function book() { return true; }\n');
    this.stage(); this.git(['commit', '-qm', 'Accept initial contract']); this.repo = new Repository(this.root);
  }
  git(args: string[], input?: string): string {
    const result = spawnSync('git', ['-C', this.root, ...args], { input, encoding: 'utf8' });
    if (result.error || result.status !== 0) throw Error(result.error?.message || result.stderr);
    return result.stdout.trimEnd();
  }
  write(path: string, data: string | Buffer): void { const full = join(this.root, path); mkdirSync(dirname(full), { recursive: true }); writeFileSync(full, data); }
  read(path: string): string { return readFileSync(join(this.root, path), 'utf8'); }
  stage(): void { this.git(['add', '-A']); }
  cli(command: string): ReturnType<typeof spawnSync> { return spawnSync(process.execPath, [BUNDLE, '--repo', this.root, command], { encoding: 'utf8' }); }
  verify(): ReturnType<typeof spawnSync> { return this.cli('verify'); }
  commit(): ReturnType<typeof spawnSync> { return spawnSync('git', ['-C', this.root, 'commit', '-m', 'Candidate change'], { encoding: 'utf8' }); }
  installTrusted(): void {
    cpSync(join(PROJECT, 'runtime'), join(this.root, 'runtime'), { recursive: true });
    this.stage(); this.git(['commit', '-qm', 'Install trusted tool']);
    const result = this.cli('install-hook'); if (result.status !== 0) throw Error(String(result.stderr));
  }
  async start(): Promise<void> {
    if (this.port !== undefined) return;
    this.server = spawn(process.execPath, [BUNDLE, '--repo', this.root, 'serve', '--port', '0'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let logs = '';
    const port = await new Promise<number>((resolve, reject) => {
      const timeout = setTimeout(() => reject(Error('Local server did not start: ' + logs)), 10000);
      this.server!.once('error', error => { clearTimeout(timeout); reject(error); });
      this.server!.once('exit', code => { clearTimeout(timeout); reject(Error('Local server exited: ' + code + ' ' + logs)); });
      this.server!.stderr!.on('data', data => { logs += String(data); });
      this.server!.stdout!.on('data', data => {
        logs += String(data); const match = logs.match(/Intent DD: http:\/\/127\.0\.0\.1:(\d+)/);
        if (match) { clearTimeout(timeout); resolve(Number(match[1])); }
      });
    });
    this.port = port;
    const response = await this.request('GET', '/');
    this.token = response.body.match(/name="intent-dd-token" content="([^"]+)"/)?.[1];
    if (!this.token) throw Error('Missing session token');
  }
  async request(method: string, path: string, value?: unknown, headers: Record<string, string> = {}): Promise<Response> {
    if (this.port === undefined) throw Error('Start server first');
    const body = value === undefined ? undefined : JSON.stringify(value);
    const allHeaders = { 'Content-Type': 'application/json', ...(this.token ? { 'X-IntentDD-Token': this.token } : {}),
      ...(body !== undefined ? { 'Content-Length': String(Buffer.byteLength(body)) } : {}), ...headers };
    return await new Promise<Response>((resolve, reject) => {
      const request = httpRequest({ hostname: '127.0.0.1', port: this.port, path, method, headers: allHeaders }, response => {
        const chunks: Buffer[] = []; response.on('data', data => chunks.push(Buffer.from(data)));
        response.on('end', () => resolve({ status: response.statusCode || 0, body: Buffer.concat(chunks).toString('utf8') }));
      });
      request.setTimeout(10000, () => request.destroy(Error('HTTP timeout'))); request.on('error', reject); request.end(body);
    });
  }
  async workspace(): Promise<Workspace> { await this.start(); const response = await this.request('GET', '/api/workspace'); if (response.status !== 200) throw Error(response.body); return JSON.parse(response.body) as Workspace; }
  async annotate(enabled: boolean, original?: Scenario): Promise<Response> {
    const scenario = original || (await this.workspace()).scenarios[0]; this.annotationHead = this.repo.head;
    return this.request('POST', '/api/annotation', { path: scenario.path, line: scenario.line, sourceHash: scenario.sourceHash, enabled });
  }
  async approval(revision?: Revision, changes: Record<string, unknown> = {}): Promise<Response> {
    revision ||= (await this.workspace()).review.revision;
    return this.request('POST', '/api/approval', { revision, reviewer: 'Acceptance test human', reason: 'New requirement accepted', acknowledgement: 'APPROVE INTENT CHANGE', ...changes });
  }
  async close(): Promise<void> {
    if (this.server && this.server.exitCode === null && this.server.signalCode === null) {
      const exited = once(this.server, 'exit'); this.server.kill(); await exited;
    }
    rmSync(this.root, { recursive: true, force: true });
  }
}
