import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PresentationDriver } from '../features/support/presentation-driver.js';
import { renderLineage } from '../src/lineage/report.js';
import { readFileSync } from 'node:fs';

const lineage = { tags: ['integrated-lineage'] };

describe('Integrated Agent Intent report', () => {
  it('embeds the logo and permits its image source in the local report policy', { tags: ['report-brand-logo'] }, async () => {
    const d = new PresentationDriver();
    try {
      d.fixtures(); d.run();
      const response = await d.request('/');
      const html = await response.text();
      const image = html.match(/<img class="brand-logo" src="data:image\/png;base64,([A-Za-z0-9+/=]+)"/);
      assert.ok(image, 'Missing embedded logo');
      assert.deepEqual(Buffer.from(image[1], 'base64'), readFileSync(new URL('../assets/agent-intent-logo.png', import.meta.url)));
      const policy = response.headers.get('content-security-policy') ?? '';
      const sources = policy.split(';').map(part => part.trim()).find(part => part.startsWith('img-src '))?.split(/\s+/).slice(1);
      assert.deepEqual(sources, ["'self'", 'data:']);
      assert.match(policy, /script-src 'self';/);
      assert.match(d.html(), /<img class="brand-logo" src="data:image\/png;base64,/);
    } finally { await d.stop(); }
  });

  it('keeps accepted Gherkin and linked BDD tests together on the home page', lineage, async () => {
    const d = new PresentationDriver();
    try {
      await d.acceptInitial();
      const response = await d.request('/');
      assert.equal(response.status, 200);
      const html = await response.text();
      assert.match(html, /<title>Agent Intent report<\/title>/);
      const first = [...html.matchAll(/<section\b[^>]*>[\s\S]*?<\/section>/g)]
        .find(match => match[0].includes('<h2>First specification</h2>'))![0];
      assert.match(first.replace(/<\/?span\b[^>]*>/g, ''), /class="gherkin-specification"[\s\S]*?<pre>[^<]*Scenario: First specification[^<]*Given the first promise[^<]*<\/pre>/);
      assert.match(first, /<li[^>]*data-lineage="@first"[^>]*>Reporting › supports the first promise/);
      assert.match(first, /class="scenario-lineage">Lineage IDs: @first<\/p>/);
      assert.doesNotMatch(first, /class="spec-change"|supports the second promise/);
    } finally { await d.stop(); }
  });

  it('includes the same Gherkin and visible lineage in the generated standalone report', lineage, () => {
    const d = new PresentationDriver();
    try {
      d.fixtures(); d.run();
      const html = d.html();
      assert.match(html, /<h1>Agent Intent report<\/h1>/);
      assert.match(html.replace(/<\/?span\b[^>]*>/g, ''), /class="gherkin-specification"[\s\S]*?Given the first promise/);
      assert.match(html, /data-lineage="@first"[^>]*>Reporting › supports the first promise/);
      assert.match(html, /class="scenario-lineage">Lineage IDs: @first<\/p>/);
    } finally { d.close(); }
  });

  it('keeps shared lineage at scenario level and escapes additional tags', lineage, () => {
    const id = 'promise"><script>bad</script>';
    const html = renderLineage([{ id: 's', path: 'a.feature', name: 'A promise', tags: ['@' + id] }], [
      { description: 'supports the promise', tags: [id, 'other-id'] },
    ]);
    assert.match(html, /Lineage IDs: @promise&quot;&gt;&lt;script&gt;bad&lt;\/script&gt;<\/p>/);
    assert.match(html, /<small class="test-tags">@other-id<\/small>/);
    assert.doesNotMatch(html, /<script>|class="test-lineage"/);
  });
});
