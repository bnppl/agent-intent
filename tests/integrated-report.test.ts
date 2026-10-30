import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PresentationDriver } from '../features/support/presentation-driver.js';
import { renderLineage } from '../src/lineage/report.js';

const lineage = { tags: ['integrated-lineage'] };

describe('Integrated Intent DD report', () => {
  it('keeps accepted Gherkin and linked BDD tests together on the home page', lineage, async () => {
    const d = new PresentationDriver();
    try {
      await d.acceptInitial();
      const response = await d.request('/');
      assert.equal(response.status, 200);
      const html = await response.text();
      assert.match(html, /<title>Intent DD report<\/title>/);
      const first = [...html.matchAll(/<section\b[^>]*>[\s\S]*?<\/section>/g)]
        .find(match => match[0].includes('<h2>First specification</h2>'))![0];
      assert.match(first, /class="gherkin-specification"[\s\S]*?<pre>[^<]*Scenario: First specification[^<]*Given the first promise[^<]*<\/pre>/);
      assert.match(first, /<li[^>]*data-lineage="@first"[^>]*>Reporting › supports the first promise/);
      assert.match(first, /Lineage: @first<\/small>/);
      assert.doesNotMatch(first, /class="spec-change"|supports the second promise/);
    } finally { await d.stop(); }
  });

  it('includes the same Gherkin and visible lineage in the generated standalone report', lineage, () => {
    const d = new PresentationDriver();
    try {
      d.fixtures(); d.run();
      const html = d.html();
      assert.match(html, /<h1>Intent DD report<\/h1>/);
      assert.match(html, /class="gherkin-specification"[\s\S]*?Given the first promise/);
      assert.match(html, /data-lineage="@first"[^>]*>Reporting › supports the first promise/);
      assert.match(html, /Lineage: @first<\/small>/);
    } finally { d.close(); }
  });

  it('shows only matching lineage IDs and renders them as text', lineage, () => {
    const id = 'promise"><script>bad</script>';
    const html = renderLineage([{ id: 's', path: 'a.feature', name: 'A promise', tags: ['@' + id] }], [
      { description: 'supports the promise', tags: [id, 'other-id'] },
    ]);
    assert.match(html, /Lineage: @promise&quot;&gt;&lt;script&gt;bad&lt;\/script&gt;<\/small>/);
    assert.doesNotMatch(html, /<script>|other-id/);
  });
});
