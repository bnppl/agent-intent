import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { html, css, js } from 'intentdd:assets';
import { IntentError, Repository } from './core/repository.js';
import { annotate } from './core/gherkin.js';
import { approve, catalogue, config, object, report, sameRevision, validRevision } from './core/verification.js';
import type { AnnotationRequest, ApprovalRequest, Workspace } from './core/types.js';

const LIMIT = 65536;
export function makeServer(root: string): Server {
  const repo = new Repository(root), token = randomBytes(32).toString('base64url');
  const server = createServer((request, response) => { void handle(request, response); });
  function send(response: ServerResponse, code: number, value: unknown, type = 'application/json'): void {
    const body = type === 'application/json' ? JSON.stringify(value) : String(value);
    response.writeHead(code, { 'Content-Type': type + '; charset=utf-8', 'Content-Length': Buffer.byteLength(body),
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'" });
    response.end(body);
  }
  async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new IntentError('Server not listening');
      const host = '127.0.0.1:' + address.port;
      if (request.headers.host !== host) throw new IntentError('Use the exact 127.0.0.1 URL printed by the server');
      if (request.headers.origin && request.headers.origin !== 'http://' + host) throw new IntentError('Cross-origin access refused');
      if (request.headers['sec-fetch-site'] === 'cross-site') throw new IntentError('Cross-site access refused');
      const path = new URL(request.url || '/', 'http://' + host).pathname;
      if (request.method === 'GET') {
        if (path === '/') return send(response, 200, html.replace('__SESSION_TOKEN__', token), 'text/html');
        if (path === '/app.js') return send(response, 200, js, 'text/javascript');
        if (path === '/style.css') return send(response, 200, css, 'text/css');
        if (path === '/api/workspace') {
          const snapshot = repo.snapshot('WORKTREE'), cfg = config(snapshot), rows = catalogue(snapshot, cfg), review = report(repo), diff = repo.diff();
          if (!sameRevision(repo.revision(), review.revision)) throw new IntentError('Index changed while opening review; refresh');
          const workspace: Workspace = { root: repo.root, scenarios: rows, config: cfg, review, diff,
            boundary: 'Local workflow guard; same-user agents can bypass Git hooks. Use protected CI for adversarial enforcement.' };
          return send(response, 200, workspace);
        }
        return send(response, 404, { error: 'Not found' });
      }
      if (request.method !== 'POST') return send(response, 405, { error: 'Method not allowed' });
      const supplied = Buffer.from(String(request.headers['x-intentdd-token'] || '')), expected = Buffer.from(token);
      if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return send(response, 403, { error: 'Missing or invalid session token' });
      if (request.headers['content-type']?.split(';')[0] !== 'application/json') return send(response, 415, { error: 'JSON body required' });
      const length = Number(request.headers['content-length']);
      if (!Number.isSafeInteger(length) || length < 1 || length > LIMIT) return send(response, 413, { error: 'Invalid request size' });
      const chunks: Buffer[] = []; let size = 0;
      for await (const chunk of request) { const data = Buffer.from(chunk); size += data.length; if (size > LIMIT) { send(response, 413, { error: 'Invalid request size' }); return; } chunks.push(data); }
      if (size !== length) throw new IntentError('Incomplete request body');
      const value: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!object(value)) throw new IntentError('Expected a JSON object');
      // All mutations after body collection are synchronous: no interleaved annotation or approval.
      if (path === '/api/annotation') {
        if (typeof value.path !== 'string' || typeof value.sourceHash !== 'string' || !/^[0-9a-f]{64}$/.test(value.sourceHash)
          || typeof value.enabled !== 'boolean' || !Number.isSafeInteger(value.line) || Number(value.line) < 1) throw new IntentError('Invalid annotation request');
        annotate(repo, value as unknown as AnnotationRequest, config(repo.snapshot('WORKTREE')).feature_roots);
        return send(response, 200, { saved: true, staged: false });
      }
      if (path === '/api/approval') {
        if (!validRevision(value.revision) || typeof value.reviewer !== 'string' || typeof value.reason !== 'string'
          || typeof value.acknowledgement !== 'string' || value.reviewer.length > 100 || value.reason.length > 2000) throw new IntentError('Invalid approval request');
        const approved = approve(repo, value as unknown as ApprovalRequest);
        return send(response, 200, { approved: true, revision: approved.revision });
      }
      return send(response, 404, { error: 'Not found' });
    } catch (error) { if (!response.headersSent) send(response, 409, { error: error instanceof Error ? error.message : String(error) }); else response.end(); }
  }
  server.requestTimeout = 10000;
  server.headersTimeout = 10000;
  return server;
}
export async function serve(root: string, port: number): Promise<void> {
  const server = makeServer(root);
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  const address = server.address();
  if (address && typeof address !== 'string') console.log(`Intent DD: http://127.0.0.1:${address.port}`);
  console.log('Bound to loopback. Source annotations write directly to disk; staging remains explicit.');
}
