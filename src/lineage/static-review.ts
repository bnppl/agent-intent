import type { EditorOptions } from '../core/editor.js';
import { definitionText } from './definition.js';
import { renderLineage } from './report.js';
import { approvalText } from './review.js';
import type { StaticReview } from './review.js';

// Fixed code: untrusted Gherkin and names are passed only through inert JSON and textContent.
const client = `
const review = JSON.parse(document.getElementById('review-data').textContent);
const output = document.getElementById('approval-text');
const copy = document.getElementById('copy-approvals');
const summary = document.getElementById('approval-summary');
const message = document.getElementById('copy-message');
const choices = [...document.querySelectorAll('input[data-review-key]')];
function update() {
  const keys = new Set(choices.filter(input => input.checked).map(input => input.dataset.reviewKey));
  const decisions = review.records.filter(record => keys.has(record.key));
  summary.textContent = decisions.length ? decisions.length + ' selected: ' + decisions.map(record =>
    record.name + ' (' + record.path + (record.proposed === null ? '; removal' : '; change') + ')').join('; ')
    : 'No approvals selected.';
  output.value = decisions.length ? '-----BEGIN AGENT INTENT APPROVAL-----\\n' +
    JSON.stringify({version: 1, reviewId: review.reviewId, decisions}, null, 2) +
    '\\n-----END AGENT INTENT APPROVAL-----' : '';
  copy.disabled = !decisions.length;
  message.textContent = '';
}
choices.forEach(input => { input.checked = false; input.addEventListener('change', update); });
document.getElementById('clear-approvals').addEventListener('click', () => {
  choices.forEach(input => { input.checked = false; }); update();
});
copy.addEventListener('click', async () => {
  const text = output.value;
  try {
    if (!navigator.clipboard) throw Error('Clipboard unavailable');
    await navigator.clipboard.writeText(text);
    message.textContent = output.value === text ? 'Copied. Paste this approval into the agent conversation.' :
      'Selection changed while copying. Copy your current selection again.';
  } catch {
    output.focus(); output.select(); output.setSelectionRange(0, output.value.length);
    message.textContent = 'Clipboard unavailable. Long-press the selected text and copy it manually.';
  }
});
window.addEventListener('pageshow', () => {
  choices.forEach(input => { input.checked = false; }); update();
});
update();
`;

const styles = `
.approval-panel { border: 1px solid var(--border); padding: 18px; background: #fff; border-radius: 8px; margin: 20px 0; }
.approval-panel h2 { display: block; font-size: 1.2rem; }
.approval-panel button { min-height: 44px; margin: 8px 8px 8px 0; }
.approval-choice { display: flex; align-items: center; gap: 12px; min-height: 48px; cursor: pointer; }
.approval-choice input { width: 24px; height: 24px; flex-shrink: 0; }
#approval-text { width: 100%; min-height: 180px; font: 13px/1.5 ui-monospace, monospace; padding: 12px; }
#approval-summary { overflow-wrap: anywhere; }
pre { max-width: 100%; }
@media(max-width: 650px) { .approval-panel { padding: 12px; } }
`;

export function renderStaticReview(review: StaticReview, editor?: EditorOptions): { html: string; text: string } {
  const { snapshot, accepted } = review.model;
  let html = renderLineage(snapshot.scenarios, snapshot.tests, { editor, accepted, runFailed: snapshot.runFailed, staticReview: true });
  const panel = `<aside class="approval-panel" aria-label="Prepare approvals">
<h2>Prepare your approvals</h2>
<p>Expand specifications below to review the accepted and proposed definitions. Select changes individually, then return here.</p>
<p id="approval-summary" aria-live="polite">No approvals selected.</p>
<button id="copy-approvals" type="button" disabled>Copy approvals</button>
<button id="clear-approvals" type="button">Clear selection</button>
<p><label for="approval-text">Approval text — copy and paste into the agent conversation</label></p>
<textarea id="approval-text" readonly spellcheck="false" autocomplete="off"></textarea>
<p id="copy-message" role="status"></p>
<p>Nothing is accepted in this file. The importer validates your exact decisions before updating the lock. Specification agreement does not mean tests passed or approve implementation changes.</p>
<p class="help">Review ID: ${review.reviewId}. Integrity identifier only; this does not authenticate a person.</p>
<noscript><p>This viewer cannot run the selection controls. Use the companion .txt file and copy only the approval blocks you authorise.</p></noscript>
</aside>`;
  // Escaping '<' prevents names containing closing script tags from escaping the data block.
  const data = JSON.stringify({ reviewId: review.reviewId, records: review.records }).replaceAll('<', '\\u003c');
  html = html.replace('</head>', `<style>${styles}</style></head>`)
    .replace('<main>', '<main>\n' + panel)
    .replace('</body>', () => `<script id="review-data" type="application/json">${data}</script><script>${client}</script></body>`);
  const lines = ['Agent Intent — mobile specification review', 'Review ID: ' + review.reviewId,
    'Review before copying. Copy only the complete approval blocks you authorise.',
    'You may paste several blocks together as one batch. Unselected changes remain pending.',
    'Copying does not update acceptance. Hashes are integrity identifiers, not signatures.',
    'After any acceptance or report/source change, request a fresh review before approving more.',
    'Test outcomes: ' + (snapshot.runFailed ? 'RUN FAILED' : 'No run-level failure recorded; inspect individual results below.'), ''];
  for (const record of review.records) {
    const previous = accepted.find(s => s.key === record.key);
    const proposed = snapshot.scenarios.find(s => s.key === record.key);
    const related = proposed ? snapshot.tests.filter(t => proposed.tags.some(tag => t.tags.includes(tag.slice(1)))) : [];
    lines.push('='.repeat(48), record.name + ' — ' + record.path,
      'Change: ' + (record.proposed === null ? 'REMOVED' : previous ? 'MODIFIED' : 'ADDED'),
      'Previously accepted:', previous ? definitionText(previous.definition) : '(not previously accepted)',
      'Proposed:', proposed ? definitionText(proposed.definition) : '(removed)', 'Supporting tests:',
      ...related.map(t => (t.status ?? 'passed').toUpperCase() + ': ' + t.description + ' [' +
        t.tags.filter(tag => proposed!.tags.includes('@' + tag)).join(', ') + ']'),
      ...(related.length ? [] : ['Not run: no associated unit tests ran with a matching lineage ID.']),
      '', 'COPY ONLY IF YOU APPROVE THIS SPECIFICATION ' + (record.proposed === null ? 'REMOVAL' : 'CHANGE') + ':',
      approvalText(review.reviewId, [record]), '');
  }
  if (!review.records.length) lines.push('No specification changes awaiting acceptance.');
  return { html, text: lines.join('\n') + '\n' };
}
