import { decisionStatus, type DecisionInbox, type DecisionItem } from '../decisions.js';
const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');

export function renderDecisionInbox(inbox: DecisionInbox): string {
  const groups = new Map<string, { journey: string; component: string; items: DecisionItem[] }>();
  for (const item of inbox.items) {
    const key = JSON.stringify([item.journey, item.component]);
    if (!groups.has(key)) groups.set(key, { journey: item.journey, component: item.component, items: [] });
    groups.get(key)!.items.push(item);
  }
  return `<article class="decision-inbox"><h2>Decision inbox</h2>
<p>${inbox.items.filter(item => decisionStatus(item) === 'unresolved').length} unresolved · ${inbox.items.length} total</p>
<p>Review implementation choices separately from specification changes. Flexibility never overrides accepted requirements. Protect records a need for a contract or test; it does not create one or prove coverage.</p>
<p><a href="/?view=changes">Return to specification changes</a></p>
<p id="decision-message" role="status"></p>
${[...groups.values()].map(group => `<section class="decision-group"><h3>${escape(group.journey)} · ${escape(group.component)}</h3>${group.items.map(item => {
    const status = decisionStatus(item), previous = item.decision;
    return `<article class="decision-item" data-decision-id="${escape(item.id)}" data-status="${status}">
<h4>${escape(item.title)} <span class="badge">${status === 'unresolved' ? 'Unresolved' : status === 'protect' ? 'Protect' : 'Flexible'}</span></h4>
${item.specification ? `<p>Specification reference: ${escape(item.specification)}</p>` : '<p>No specification linked. Review the relevant requirements before classifying.</p>'}
<details><summary>Evidence</summary><pre>${escape(item.evidence)}</pre></details>
${previous ? `<p>${status === 'unresolved' ? 'Previous decision (evidence changed; review again)' : 'Recorded decision'}: ${escape(previous.classification)}</p><p>Scope: ${escape(previous.scope)}</p><p>Rationale: ${escape(previous.rationale)}</p>` : ''}
<form data-decision-form><label>Classification<select name="classification" aria-label="Classification" required><option value="">Choose a decision</option><option value="protect">Protect behavior — needs a contract / test</option><option value="flexible">Allow implementation flexibility</option></select></label>
<label>Scope<textarea name="scope" aria-label="Scope" required maxlength="32000"></textarea></label>
<label>Rationale<textarea name="rationale" aria-label="Rationale" required maxlength="32000"></textarea></label>
<button type="submit">Record decision</button></form></article>`;
  }).join('')}</section>`).join('') || '<p>No decisions proposed. Import proposals or mutation evidence to begin.</p><pre>npm run intent -- decisions --file proposals.json\nnpm run intent -- mutations --file reports/mutation/mutation.json</pre><p>See the README for the proposal format. Imports never classify choices for you.</p>'}</article>`;
}
