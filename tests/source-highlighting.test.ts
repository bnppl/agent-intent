import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { renderLineage } from '../src/lineage/report.js';

const tag = {tags:['source-highlighting']};
function report(code: string, path: string): string {
  return renderLineage([{id:'s', path:'s.feature', name:'A promise', tags:['@promise']}], [
    {description:'supports the promise', tags:['promise'], source:{path, line:1, code}},
  ]);
}
describe('Highlighted test source', () => {
  for (const [path, code] of [
    ['spec.mjs', 'const value = "example"; // a comment'],
    ['spec.ts', 'const value: string = "example"; // a comment'],
  ]) {
    it('highlights keywords, strings and comments in ' + path, tag, () => {
      const html = report(code, path);
      assert.match(html, /<span class="hljs-keyword">const<\/span>/);
      assert.match(html, /<span class="hljs-string">&quot;example&quot;<\/span>/);
      assert.match(html, /<span class="hljs-comment">\/\/ a comment<\/span>/);
      assert.doesNotMatch(html, /<details class="test-code"[^>]*\bopen\b|https?:\/\/[^"']+\.js/);
    });
  }
  it('keeps hostile source inert and preserves its text', tag, () => {
    const code = `const html = '<script>alert(1)</script>';`;
    const html = report(code, 'spec.js');
    const highlighted = html.match(/<pre><code>([\s\S]*?)<\/code><\/pre>/)![1];
    assert.doesNotMatch(highlighted, /<script/);
    const text = highlighted.replace(/<\/?span\b[^>]*>/g, '')
      .replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&#39;', "'").replaceAll('&#x27;', "'").replaceAll('&quot;', '"').replaceAll('&amp;', '&');
    assert.equal(text, code);
  });
});

describe('Highlighted Gherkin specifications', () => {
  it('highlights scenario source and both sides of a specification change', {tags:['gherkin-highlighting']}, () => {
    const definition = (step: string) => JSON.stringify({contexts:[{keyword:'Feature',name:'Reporting'}],
      scenario:{keyword:'Scenario',name:'A promise',tags:[{name:'@promise'}],steps:[{keyword:'Given ',text:step}]}});
    const scenario = {id:'s', key:'promise', path:'s.feature', name:'A promise', tags:['@promise'],
      fingerprint:'current', definition:definition('a current promise')};
    const html = renderLineage([scenario], [], {accepted:[{...scenario, fingerprint:'previous', definition:definition('an accepted promise')}]});
    const blocks = [...html.matchAll(/<pre>([\s\S]*?)<\/pre>/g)].map(match => match[1]);
    assert.equal(blocks.length, 3);
    for (const block of blocks) {
      assert.match(block, /class="hljs-keyword">Scenario/);
      assert.match(block, /class="hljs-keyword">Given/);
    }
    assert.match(blocks[1], /an accepted promise/);
    assert.match(blocks[2], /a current promise/);
  });
  it('keeps HTML-like Gherkin text inert', {tags:['gherkin-highlighting']}, () => {
    const definition = JSON.stringify({contexts:[],scenario:{keyword:'Scenario',name:'<script>alert(1)</script>',
      steps:[{keyword:'Given ',text:'<img src=x onerror=alert(1)>'}]}});
    const html = renderLineage([{id:'s',path:'s.feature',name:'A promise',tags:[],definition}], []);
    assert.match(html.replace(/<\/?span\b[^>]*>/g, ''), /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    const specification = html.match(/<div class="gherkin-specification">([\s\S]*?)<\/div>/)?.[1];
    assert.ok(specification, 'Missing rendered Gherkin specification');
    assert.match(specification.replace(/<\/?span\b[^>]*>/g, ''), /&lt;img src=x onerror=alert\(1\)&gt;/);
    assert.doesNotMatch(specification, /<script\b|<img\b/i);
  });
});
