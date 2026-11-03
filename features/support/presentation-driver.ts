import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { get } from 'node:http';
import { fileURLToPath } from 'node:url';
import { LineageDriver } from './lineage-driver.js';
import type { ReportModel } from '../../src/lineage/state.js';

/** All acceptance mutations here target an isolated temporary project. */
export class PresentationDriver extends LineageDriver {
  private server?: ChildProcess;
  private origin?: string;
  private token?: string;

  fixtures(): void {
    this.write('features/example.feature', `Feature: Reporting
  @first
  Scenario: First specification
    Given the first promise
  @second
  Scenario: Second specification
    Given the second promise
`);
    this.write('example.test.mjs', `import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
describe('Reporting', () => {
  it('supports the first promise', {tags:['first']}, () => assert.ok(true));
  it('supports the second promise', {tags:['second']}, () => assert.ok(true));
});`);
  }

  async start(): Promise<void> {
    if (this.origin) return;
    this.server = spawn(process.execPath, [fileURLToPath(new URL('../../runtime/cli.cjs', import.meta.url)),
      'serve', '--port', '0'], { cwd: this.root, stdio: ['ignore', 'pipe', 'pipe'] });
    this.origin = await new Promise<string>((resolve, reject) => {
      let logs = '';
      const timeout = setTimeout(() => reject(Error('Report server timeout: ' + logs)), 10000);
      this.server!.once('error', error => { clearTimeout(timeout); reject(error); });
      this.server!.once('exit', code => { clearTimeout(timeout); reject(Error('Report server exited: ' + code + logs)); });
      this.server!.stderr!.on('data', data => { logs += String(data); });
      this.server!.stdout!.on('data', data => {
        logs += String(data);
        const match = logs.match(/Agent Intent: (http:\/\/127\.0\.0\.1:\d+)/);
        if (match) { clearTimeout(timeout); resolve(match[1]); }
      });
    });
    const html = await (await fetch(this.origin + '/lineage')).text();
    this.token = html.match(/name="agent-intent-token" content="([^"]+)"/)?.[1];
  }

  async request(path: string, value?: unknown, token?: string, headers: Record<string, string> = {}): Promise<Response> {
    await this.start();
    return fetch(this.origin + path, value === undefined ? { headers } : { method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Agent-Intent-Token': token ?? this.token ?? '', ...headers }, body: JSON.stringify(value) });
  }

  async rawStatus(path: string, headers: Record<string, string>): Promise<number> {
    await this.start();
    return new Promise((resolve, reject) => {
      get(this.origin + path, { headers }, response => {
        response.resume(); resolve(response.statusCode!);
      }).on('error', reject);
    });
  }

  async model(): Promise<ReportModel> {
    const response = await this.request('/api/lineage');
    assert.equal(response.status, 200, await response.clone().text());
    return response.json();
  }

  async accept(name: string): Promise<Response> {
    const model = await this.model();
    const scenario = [...model.snapshot.scenarios, ...model.accepted].find(s => s.name === name);
    assert.ok(scenario, 'Specification not found: ' + name);
    const prior = model.accepted.find(s => s.key === scenario.key);
    return this.request('/api/lineage/accept', { revision: model.revision, key: scenario.key,
      expectedAcceptance: prior?.fingerprint ?? null });
  }

  async acceptInitial(): Promise<void> {
    this.fixtures(); this.run();
    for (const name of ['First specification', 'Second specification']) {
      const response = await this.accept(name);
      assert.equal(response.status, 200, await response.text());
    }
  }

  async page(): Promise<string> { return (await this.request('/lineage')).text(); }

  async stop(): Promise<void> {
    if (this.server && this.server.exitCode === null && this.server.signalCode === null) {
      const exited = once(this.server, 'exit'); this.server.kill(); await exited;
    }
    this.close();
  }
}
