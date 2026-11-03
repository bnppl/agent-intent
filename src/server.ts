import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { lineageJs } from 'agent-intent:assets';
import { editorOptions } from './core/editor.js';
import { resolve } from 'node:path';
import { IntentError, object } from './core/files.js';
import { acceptSpecification, reportModel } from './lineage/state.js';
import { renderLineage } from './lineage/report.js';
import { lineageStyles } from './lineage/style.js';

const LIMIT = 65536;
export function makeServer(root: string): Server {
  root = resolve(root);
  const token = randomBytes(32).toString('base64url');
  const server = createServer((request, response) => { void handle(request, response); });
  function send(response: ServerResponse, code: number, value: unknown, type = 'application/json'): void {
    const body = type === 'application/json' ? JSON.stringify(value) : String(value);
    response.writeHead(code, { 'Content-Type': type + '; charset=utf-8', 'Content-Length': Buffer.byteLength(body),
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'" });
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
      const url = new URL(request.url || '/', 'http://' + host);
      const path = url.pathname;
      if (request.method === 'GET') {
        if (path === '/lineage.css') return send(response, 200, lineageStyles, 'text/css');
        if (path === '/lineage.js') return send(response, 200, lineageJs, 'text/javascript');
        if (path === '/api/lineage') return send(response, 200, reportModel(root));
        if (path === '/' || path === '/lineage') {
          const model = reportModel(root);
          const requestedView = url.searchParams.get('view');
          const view = requestedView === 'changes' || requestedView === 'workflow' ? requestedView : 'specifications';
          return send(response, 200, renderLineage(model.snapshot.scenarios, model.snapshot.tests,
            { editor: editorOptions(root), runFailed: model.snapshot.runFailed, accepted: model.accepted, revision: model.revision, sessionToken: token, view }), 'text/html');
        }
        return send(response, 404, { error: 'Not found' });
      }
      if (request.method !== 'POST') return send(response, 405, { error: 'Method not allowed' });
      const supplied = Buffer.from(String(request.headers['x-agent-intent-token'] || '')), expected = Buffer.from(token);
      if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return send(response, 403, { error: 'Missing or invalid session token' });
      if (request.headers['content-type']?.split(';')[0] !== 'application/json') return send(response, 415, { error: 'JSON body required' });
      const length = Number(request.headers['content-length']);
      if (!Number.isSafeInteger(length) || length < 1 || length > LIMIT) return send(response, 413, { error: 'Invalid request size' });
      const chunks: Buffer[] = []; let size = 0;
      for await (const chunk of request) { const data = Buffer.from(chunk); size += data.length; if (size > LIMIT) { send(response, 413, { error: 'Invalid request size' }); return; } chunks.push(data); }
      if (size !== length) throw new IntentError('Incomplete request body');
      const value: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!object(value)) throw new IntentError('Expected a JSON object');
      // Acceptance mutations are synchronous after body collection.
      if (path === '/api/lineage/accept') {
        if (typeof value.revision !== 'string' || !/^[0-9a-f]{64}$/.test(value.revision)
          || typeof value.key !== 'string' || value.key.length > 4096
          || (value.expectedAcceptance !== null && (typeof value.expectedAcceptance !== 'string'
            || !/^[0-9a-f]{64}$/.test(value.expectedAcceptance)))) throw new IntentError('Invalid specification acceptance request');
        acceptSpecification(root, { revision: value.revision, key: value.key, expectedAcceptance: value.expectedAcceptance as string | null });
        return send(response, 200, { accepted: true, key: value.key });
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
  if (address && typeof address !== 'string') console.log(`Agent Intent: http://127.0.0.1:${address.port}`);
  if (process.send) process.send('agent-intent:ready');
  console.log('Bound to loopback. Review and accept individual specification changes into agent-intent.lock.json.');
}
