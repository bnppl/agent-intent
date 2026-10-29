import type { ApprovalRequest, AnnotationRequest, Scenario, Workspace } from '../core/types.js';
function $<T extends HTMLElement = HTMLElement>(selector: string): T {
  const value = document.querySelector<T>(selector); if (!value) throw Error('Missing UI element: ' + selector); return value;
}
const token = $<HTMLMetaElement>('meta[name="intent-dd-token"]').content;
let workspace: Workspace | undefined, selected: Scenario | undefined, busy = false;
function node<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] {
  const value = document.createElement(tag); if (text !== undefined) value.textContent = text; if (className) value.className = className; return value;
}
function status(message: string, error = false): void { $('#status').textContent = message; $('#status').classList.toggle('error', error); }
function errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }
async function request<T>(path: string, value?: AnnotationRequest | ApprovalRequest): Promise<T> {
  const result = await fetch(path, value === undefined ? { cache: 'no-store' } : { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-IntentDD-Token': token }, body: JSON.stringify(value) });
  const body = await result.json() as T & { error?: string }; if (!result.ok) throw Error(body.error || 'Request failed'); return body;
}
async function refresh(message?: string): Promise<void> {
  try {
    workspace = await request<Workspace>('/api/workspace'); selected = workspace.scenarios.find(s => s.id === selected?.id)
      || workspace.scenarios.find(s => s.path === selected?.path && s.name === selected?.name) || workspace.scenarios[0];
    render(); status(message || 'Repository loaded. Annotations write to disk; stage changes explicitly.');
  } catch (error) { status(errorMessage(error), true); $('#approvalForm').hidden = true; $<HTMLInputElement>('#intentToggle').disabled = true; }
}
function render(): void {
  if (!workspace) return;
  $('#repo').textContent = workspace.root; $('#count').textContent = String(workspace.scenarios.length);
  $('#reviewCount').textContent = workspace.review.changes.length ? '(' + workspace.review.changes.length + ')' : '';
  renderList(); renderSelection(); renderReview();
}
function renderList(): void {
  if (!workspace) return;
  const query = $<HTMLInputElement>('#search').value.toLowerCase(), list = $('#scenarios'); list.replaceChildren();
  for (const scenario of workspace.scenarios.filter(s => (s.name + ' ' + s.path).toLowerCase().includes(query))) {
    const button = node('button', undefined, 'scenario' + (scenario.id === selected?.id ? ' active' : ''));
    button.setAttribute('aria-pressed', String(scenario.id === selected?.id));
    button.append(node('span', scenario.intent ? '◆ INTENT' : 'UNMARKED', 'badge' + (scenario.intent ? '' : ' plain')), node('b', scenario.name), node('div', scenario.id, 'path'));
    button.onclick = () => { selected = scenario; renderList(); renderSelection(); }; list.append(button);
  }
  if (!list.children.length) list.append(node('div', 'No matching scenarios. Add a .feature file under a configured root.', 'empty'));
}
function renderSelection(): void {
  $('#selectionEmpty').hidden = Boolean(selected); $('#selection').hidden = !selected; if (!selected || !workspace) return;
  $('#kind').textContent = selected.keyword + ' / ' + (selected.inheritedIntent ? 'inherited protection' : 'scenario annotation');
  $('#name').textContent = selected.name; $('#path').textContent = selected.id; $('#source').textContent = selected.source;
  const toggle = $<HTMLInputElement>('#intentToggle'); toggle.checked = selected.intent; toggle.disabled = busy || selected.inheritedIntent;
  $('#classification').textContent = selected.intent ? 'HUMAN REVIEW REQUIRED' : 'AI EDITABLE';
  $('#annotationHint').textContent = selected.inheritedIntent ? 'Intent comes from a Feature, Rule, or Examples tag. Edit the parent tag in source; the commit still requires review.' : 'Toggle to add or remove @intent in this scenario’s source. Changes are not automatically staged or committed.';
  $('#glueRoots').replaceChildren(...workspace.config.glue_roots.map(p => node('code', p)));
}
function renderReview(): void {
  if (!workspace) return; const review = workspace.review;
  $('#reviewStatus').textContent = review.approved && review.requiresApproval ? 'This exact staged revision has a local human approval.' : review.requiresApproval ? 'A protected contract, glue, or verification-control change requires review.' : 'No protected changes are staged.';
  $('#revision').textContent = 'HEAD ' + review.revision.head + ' / INDEX TREE ' + review.revision.tree;
  $('#changedFiles').replaceChildren(...review.changes.map(change => { const line = node('div', undefined, 'changed'); line.append(node('code', change.path), node('span', change.change + ' · ' + change.category, 'muted')); return line; }));
  $('#diff').textContent = workspace.diff || 'No staged diff.'; $('#approvalForm').hidden = !review.requiresApproval || review.approved;
}
$<HTMLInputElement>('#intentToggle').onchange = async () => {
  if (busy || !selected) return; busy = true;
  const scenario = selected, enabled = $<HTMLInputElement>('#intentToggle').checked; renderSelection();
  try { await request('/api/annotation', { path: scenario.path, line: scenario.line, sourceHash: scenario.sourceHash, enabled }); await refresh('Saved @intent annotation directly to source. Stage the change when ready.'); }
  catch (error) { status(errorMessage(error), true); } finally { busy = false; renderSelection(); }
};
$<HTMLFormElement>('#approvalForm').onsubmit = async event => {
  event.preventDefault(); if (!workspace) return; const button = event.submitter as HTMLButtonElement; button.disabled = true;
  try { await request('/api/approval', { revision: workspace.review.revision, reviewer: $<HTMLInputElement>('#reviewer').value, reason: $<HTMLInputElement>('#reason').value, acknowledgement: $<HTMLInputElement>('#acknowledgement').value }); $<HTMLInputElement>('#acknowledgement').value = ''; await refresh('Approved the exact staged revision. Commit without changing the index.'); }
  catch (error) { status(errorMessage(error), true); } finally { button.disabled = false; }
};
$('#reload').onclick = () => { void refresh(); }; $<HTMLInputElement>('#search').oninput = renderList;
for (const name of ['library', 'review', 'architecture']) $('#' + name + 'Tab').onclick = () => {
  for (const other of ['library', 'review', 'architecture']) { $('#' + other).hidden = name !== other; $('#' + other + 'Tab').classList.toggle('active', name === other); }
};
void refresh();
