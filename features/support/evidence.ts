import { AsyncLocalStorage } from 'node:async_hooks';
import nodeAssert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import type { SpawnSyncOptionsWithStringEncoding } from 'node:child_process';
import { inspect } from 'node:util';
import { evidenceText } from '../../src/lineage/evidence.js';

interface EvidenceScope { log: (entry: string) => void; active: boolean }
const scope = new AsyncLocalStorage<EvidenceScope>();

// Cucumber retains the original definition's arity. Keep its return value and errors intact.
export function withStepEvidence(code: (...args: unknown[]) => unknown) {
  return function (this: { log?: (entry: string) => void }, ...args: unknown[]) {
    if (typeof this?.log !== 'function') return code.apply(this, args);
    const entry = { log: this.log.bind(this), active: true };
    return scope.run(entry, () => {
      try {
        const result = code.apply(this, args);
        if (result instanceof Promise) return result.finally(() => { entry.active = false; });
        entry.active = false;
        return result;
      } catch (error) {
        entry.active = false;
        throw error;
      }
    });
  };
}

export function logEvidence(label: string, body: string): void {
  const entry = scope.getStore();
  if (entry?.active) entry.log(evidenceText(label + '\n' + body));
}

function assertEvidence(operation: string, args: unknown[]): void {
  if (!scope.getStore()?.active) return;
  const truthiness = operation === 'assert' || operation === 'assert.ok';
  const labels = truthiness ? ['Value is truthy', 'Message'] : ['Actual', 'Expected or predicate', 'Message'];
  const values = truthiness ? [Boolean(args[0]), ...args.slice(1)] : args;
  logEvidence(operation, values.map((value, index) => (labels[index] ?? `Argument ${index + 1}`) + ': ' + inspect(value, {
    depth: 2, maxArrayLength: 12, maxStringLength: 1600, customInspect: false,
  })).join('\n'));
}

export const assert: typeof nodeAssert = new Proxy(nodeAssert, {
  apply(target, receiver, args) {
    assertEvidence('assert', args);
    return Reflect.apply(target, receiver, args);
  },
  get(target, property, receiver) {
    const value = Reflect.get(target, property, receiver);
    if (typeof value !== 'function' || !/^(?:ok|fail|equal|notEqual|strictEqual|notStrictEqual|deepEqual|notDeepEqual|deepStrictEqual|notDeepStrictEqual|match|doesNotMatch|throws|doesNotThrow|rejects|doesNotReject|ifError|partialDeepStrictEqual)$/.test(String(property))) return value;
    return (...args: unknown[]) => {
      assertEvidence('assert.' + String(property), args);
      return Reflect.apply(value, target, args);
    };
  },
});

export function spawnWithEvidence(command: string, args: string[], options: SpawnSyncOptionsWithStringEncoding) {
  const result = spawnSync(command, args, options);
  logEvidence('CLI command', [command, ...args].map(arg => JSON.stringify(arg)).join(' '));
  logEvidence('CLI result', `Exit: ${result.status ?? result.signal ?? result.error?.message ?? 'unknown'}`);
  if (result.stdout) logEvidence('CLI stdout', result.stdout);
  if (result.stderr) logEvidence('CLI stderr', result.stderr);
  return result;
}

export function logRequest(method: string, url: string, headers: Headers, body?: string): void {
  logEvidence('HTTP request', `${method} ${url}\n${headerText(headers) || '(no explicit headers)'}\n\n${body ?? '(no body)'}`);
}

function headerText(headers: Headers): string {
  const lines: string[] = [];
  headers.forEach((value, name) => lines.push(name + ': ' + value));
  return lines.join('\n');
}

export async function fetchWithEvidence(url: string, init?: RequestInit): Promise<Response> {
  const request = new Request(url, init);
  const recording = scope.getStore()?.active;
  if (recording) {
    const body = typeof init?.body === 'string' ? init.body : request.body ? '(non-text body omitted)' : undefined;
    logRequest(request.method, request.url, request.headers, body);
  }
  const response = await fetch(request);
  if (recording) {
    const type = response.headers.get('content-type') ?? '';
    const body = !response.body ? '(no body)' : /^(text\/|application\/(?:[^;]+\+)?json)/i.test(type)
      ? await response.clone().text() : '(non-text body omitted)';
    logEvidence('HTTP response', `${response.status} ${response.statusText}\n${headerText(response.headers)}\n\n${body}`);
  }
  return response;
}
