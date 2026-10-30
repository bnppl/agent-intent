import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { realpathSync } from 'node:fs';
import { join } from 'node:path';
import { PresentationDriver } from '../features/support/presentation-driver.js';

const tag = {tags:['editor-links']};
describe('Report source links', () => {
  it('links scenarios and test declarations to their VS Code lines by default', tag, async () => {
    const d = new PresentationDriver();
    try {
      d.fixtures(); d.run();
      const html = await d.page();
      assert.ok(html.includes(`href="vscode://file${realpathSync(d.root)}/features/example.feature:3:1"`));
      assert.ok(html.includes(`href="vscode://file${realpathSync(d.root)}/example.test.mjs:4:1"`));
      assert.ok(d.html().includes(`href="vscode://file${realpathSync(d.root)}/example.test.mjs:4:1"`));
    } finally { await d.stop(); }
  });
  it('uses the configured IDE template and safely encodes source paths', { tags: ['editor-custom-template'] }, async () => {
    const d = new PresentationDriver();
    try {
      d.fixtures();
      d.write('.intentdd.json', JSON.stringify({version:1, feature_roots:['features'],
        editor_url_template:'my-ide://open?file={encodedPath}&line={line}&column={column}'}));
      d.write('a file #1.test.mjs', `import { it } from 'node:test';\nit('supports a promise', {tags:['first']}, () => {});`);
      d.run(['a file #1.test.mjs']);
      const url = `my-ide://open?file=${encodeURIComponent(join(realpathSync(d.root), 'a file #1.test.mjs'))}&amp;line=2&amp;column=1`;
      assert.ok((await d.page()).includes(`href="${url}"`));
      assert.ok(d.html().includes(`href="${url}"`));
    } finally { await d.stop(); }
  });
  it('rejects executable or incomplete IDE templates', { tags: ['editor-template-validation'] }, async () => {
    const d = new PresentationDriver();
    try {
      d.fixtures(); d.run();
      for (const template of ['javascript:alert(1)', 'data:text/html,{path}', 'vscode://file/{unknown}', 42]) {
        d.write('.intentdd.json', JSON.stringify({version:1, feature_roots:['features'], editor_url_template:template}));
        assert.equal((await d.request('/')).status, 409);
      }
    } finally { await d.stop(); }
  });
});
