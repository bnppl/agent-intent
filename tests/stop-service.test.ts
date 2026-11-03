import assert from 'node:assert/strict';
import { it } from 'node:test';
import { isProjectService } from '../src/workflow.js';

it('identifies only the Agent Intent serve command in the project folder', { tags: ['stop-service'] }, () => {
  assert.equal(isProjectService('/project', '/project', 'node runtime/cli.cjs serve'), true);
  assert.equal(isProjectService('/project', '/other', 'node runtime/cli.cjs serve'), false);
  assert.equal(isProjectService('/project', '/project', 'node other-server.js'), false);
  assert.equal(isProjectService('/project', '/project', 'node runtime/cli.cjs verify'), false);
});
