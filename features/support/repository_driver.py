"""Protocol driver: exercise Git, the CLI, and the real local HTTP API."""
import hashlib
import http.client
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
from intentdd.repository import Repository
from intentdd.server import make_server

PROJECT = Path(__file__).resolve().parents[2]
FEATURE = 'features/example.feature'
GLUE = 'features/steps/example_steps.py'
SUPPORT = 'features/support/assertions.py'


class RepositoryDriver:
    def __init__(self, marked=True):
        self.temp = tempfile.TemporaryDirectory(prefix='intent-dd-spec-')
        self.root = Path(self.temp.name)
        self.server = None
        self.git('init', '-q')
        self.git('config', 'user.name', 'Acceptance test')
        self.git('config', 'user.email', 'test@example.invalid')
        self.write('.intentdd.json', json.dumps({'version': 1, 'feature_roots': ['features'],
            'glue_roots': ['features/steps', 'features/support', 'features/environment.py'],
            'control_paths': ['intentdd', '.intentdd.json']}))
        self.write(FEATURE, 'Feature: Booking\n\n' + ('  @intent\n' if marked else '')
            + '  Scenario: Preserve a booking\n    Given a booking exists\n    Then the booking is preserved\n')
        self.write(GLUE, 'from behave import given, then\n\n@given("a booking exists")\ndef exists(context):\n    context.booking = True\n\n@then("the booking is preserved")\ndef preserved(context):\n    assert context.booking is True\n')
        self.write(SUPPORT, 'def assert_preserved(value):\n    assert value is True\n')
        self.write('app.py', 'def book():\n    return True\n')
        self.git('add', '.')
        self.git('commit', '-qm', 'Accept initial contract')
        self.repo = Repository(self.root)

    def close(self):
        if self.server:
            self.server.shutdown()
            self.server.server_close()
            self.thread.join()
        self.temp.cleanup()

    def git(self, *args):
        result = subprocess.run(['git', '-C', str(self.root), *args], capture_output=True)
        if result.returncode:
            raise AssertionError(result.stderr.decode())
        return result.stdout.decode().strip()

    def write(self, path, content):
        file = self.root / path
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_text(content)

    def read(self, path):
        return (self.root / path).read_text()

    def stage(self):
        self.git('add', '-A')

    def verify(self):
        return subprocess.run([sys.executable, '-m', 'intentdd', '--repo', str(self.root), 'verify'],
            cwd=PROJECT, capture_output=True, text=True)

    def start(self):
        if self.server:
            return
        self.server = make_server(self.root)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        html = self.request('GET', '/')[1]
        import re
        self.token = re.search(r'name="intent-dd-token" content="([^"]+)"', html).group(1)

    def request(self, method, path, body=None, headers=None):
        connection = http.client.HTTPConnection('127.0.0.1', self.server.server_port, timeout=10)
        defaults = {'Content-Type': 'application/json'}
        if hasattr(self, 'token'):
            defaults['X-IntentDD-Token'] = self.token
        defaults.update(headers or {})
        connection.request(method, path, json.dumps(body) if body is not None else None, headers=defaults)
        response = connection.getresponse()
        result = response.read().decode()
        status = response.status
        connection.close()
        return status, result

    def workspace(self):
        self.start()
        status, body = self.request('GET', '/api/workspace')
        assert status == 200, body
        return json.loads(body)

    def annotate(self, enabled):
        scenario = self.workspace()['scenarios'][0]
        self.annotation_head = self.repo.head
        return self.request('POST', '/api/annotation', {'path': scenario['path'], 'line': scenario['line'],
            'sourceHash': scenario['sourceHash'], 'enabled': enabled})

    def approval(self, revision=None):
        revision = revision or self.workspace()['review']['revision']
        return self.request('POST', '/api/approval', {'revision': revision,
            'reviewer': 'Acceptance test human', 'reason': 'New requirement accepted',
            'acknowledgement': 'APPROVE INTENT CHANGE'})
