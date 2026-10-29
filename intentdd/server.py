"""Loopback-only local editor. Never stages files, executes tests, or calls an agent."""
import json
import secrets
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
from .repository import Repository, IntentError
from .gherkin import annotate
from .verification import config, catalogue, report, approve


def make_server(root, port=0):
    repo = Repository(root)
    token = secrets.token_urlsafe(32)
    mutation_lock = threading.Lock()
    web = Path(__file__).parent / 'web'

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass  # Never emit source or review tokens to access logs.

        def send(self, status, body, content_type='application/json'):
            payload = json.dumps(body).encode() if content_type == 'application/json' else body
            self.send_response(status)
            self.send_header('Content-Type', content_type + '; charset=utf-8')
            self.send_header('Content-Length', str(len(payload)))
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'")
            self.end_headers()
            self.wfile.write(payload)

        def allowed(self):
            expected = f'127.0.0.1:{self.server.server_port}'
            if self.headers.get('Host') != expected:
                raise IntentError('Use the exact 127.0.0.1 URL printed by the server')
            origin = self.headers.get('Origin')
            if origin and origin != 'http://' + expected:
                raise IntentError('Cross-origin access refused')
            if self.headers.get('Sec-Fetch-Site') == 'cross-site':
                raise IntentError('Cross-site access refused')

        def do_GET(self):
            try:
                self.allowed()
                path = urlsplit(self.path).path
                if path == '/':
                    data = (web / 'index.html').read_bytes().replace(b'__SESSION_TOKEN__', token.encode())
                    return self.send(200, data, 'text/html')
                if path in ('/app.js', '/style.css'):
                    return self.send(200, (web / path[1:]).read_bytes(), 'text/javascript' if path.endswith('.js') else 'text/css')
                if path == '/api/workspace':
                    snapshot = repo.snapshot('WORKTREE')
                    cfg = config(snapshot)
                    rows = catalogue(snapshot, cfg)
                    review = report(repo)
                    diff = repo.diff()
                    if repo.revision() != review['revision']:
                        raise IntentError('Index changed while opening review; refresh')
                    return self.send(200, {'root': str(repo.root), 'scenarios': rows, 'config': cfg, 'review': review,
                        'diff': diff, 'boundary': 'Local workflow guard; same-user agents can bypass Git hooks. Use protected CI for adversarial enforcement.'})
                return self.send(404, {'error': 'Not found'})
            except (IntentError, OSError, UnicodeError) as error:
                return self.send(409, {'error': str(error)})

        def do_POST(self):
            try:
                self.allowed()
                if not secrets.compare_digest(self.headers.get('X-IntentDD-Token', ''), token):
                    return self.send(403, {'error': 'Missing or invalid session token'})
                if self.headers.get('Content-Type', '').split(';')[0] != 'application/json':
                    return self.send(415, {'error': 'JSON body required'})
                size = int(self.headers.get('Content-Length', '0'))
                if size < 1 or size > 65536:
                    return self.send(413, {'error': 'Invalid request size'})
                value = json.loads(self.rfile.read(size))
                with mutation_lock:
                    path = urlsplit(self.path).path
                    if path == '/api/annotation':
                        if type(value.get('enabled')) is not bool or type(value.get('line')) is not int:
                            raise IntentError('Invalid annotation request')
                        cfg = config(repo.snapshot('WORKTREE'))
                        annotate(repo, value['path'], value['line'], value['enabled'], value['sourceHash'], cfg['feature_roots'])
                        return self.send(200, {'saved': True, 'staged': False})
                    if path == '/api/approval':
                        result = approve(repo, value['revision'], value['reviewer'], value['reason'], value['acknowledgement'])
                        return self.send(200, {'approved': True, 'revision': result['revision']})
                    return self.send(404, {'error': 'Not found'})
            except (IntentError, OSError, UnicodeError, ValueError, KeyError, TypeError) as error:
                return self.send(409, {'error': str(error)})

    return ThreadingHTTPServer(('127.0.0.1', port), Handler)


def serve(root, port=8765):
    with make_server(root, port) as server:
        print(f'Intent DD: http://127.0.0.1:{server.server_port}', flush=True)
        print('Bound to loopback. Source annotations write directly to disk; staging remains explicit.', flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
