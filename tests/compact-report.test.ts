import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { renderLineage } from '../src/lineage/report.js';

const tag = {tags: ['compact-test-rows']};
const scenario = {id:'s', path:'s.feature', name:'A promise', tags:['@promise', '@reporting']};
function row(tags: string[]): string {
  return renderLineage([scenario], [{description:'supports the promise', tags}])
    .match(/<li\b[^>]*>[\s\S]*?<\/li>/)![0];
}
describe('Compact supporting test rows', () => {
  it('omits repeated parent tags and empty tag rows while retaining the lineage mapping', tag, () => {
    const html = row(['promise', 'reporting']);
    assert.match(html, /data-lineage="@promise, @reporting"/);
    assert.doesNotMatch(html, /<small/);
    assert.match(html, /<details class="test-code"><summary aria-label="View test code" title="View test code"><span aria-hidden="true">&lt;\/&gt;<\/span><\/summary>/);
    assert.doesNotMatch(html, /<details class="test-code"[^>]*\bopen\b/);
  });
  it('uses an accessible inline code icon while keeping the source collapsed', { tags: ['test-code'] }, () => {
    const html = row(['promise']);
    assert.match(html, /<summary aria-label="View test code" title="View test code"><span aria-hidden="true">&lt;\/&gt;<\/span><\/summary>/);
    assert.doesNotMatch(html, /<summary>View test code|<details class="test-code"[^>]*\bopen\b/);
  });
  it('shows each additional tag once without repeating the shared lineage', tag, () => {
    const html = row(['promise', 'reporting', 'fast', 'smoke', 'fast']);
    assert.match(html, /<small class="test-tags">@fast, @smoke<\/small>/);
    assert.doesNotMatch(html, /<small[^>]*>[^<]*@promise|<small[^>]*>[^<]*@reporting/);
  });
  it('renders additional tags safely as text', tag, () => {
    const html = row(['promise', '<img src=x onerror=alert(1)>']);
    assert.match(html, /<small class="test-tags">@&lt;img src=x onerror=alert\(1\)&gt;<\/small>/);
    assert.doesNotMatch(html, /<img/);
  });
});
