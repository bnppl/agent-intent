import { initialiseSupportingNavigation } from './supports.js';
import { initialiseExecutionTabs } from './execution-tabs.js';
import { initialiseFractalNavigation } from './fractal.js';
import { regroup } from './grouping.js';
const token = document.querySelector<HTMLMetaElement>('meta[name="agent-intent-token"]')?.content ?? '';
const revision = document.querySelector<HTMLMetaElement>('meta[name="lineage-revision"]')?.content ?? '';
const message = document.querySelector<HTMLElement>('#lineage-message');

document.querySelectorAll<HTMLButtonElement>('button[data-accept]').forEach(button => {
  button.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    button.disabled = true;
    if (message) { message.textContent = ''; message.classList.remove('error'); }
    try {
      const response = await fetch('/api/lineage/accept', { method: 'POST', headers: {
        'Content-Type': 'application/json', 'X-Agent-Intent-Token': token,
      }, body: JSON.stringify({ revision, key: button.dataset.accept, expectedAcceptance: button.dataset.previous || null }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw Error(result.error ?? 'Acceptance failed. Reload the report and try again.');
      const section = button.closest<HTMLElement>('section');
      const groups = document.querySelector<HTMLElement>('#scenario-groups');
      const changesOnly = groups?.hasAttribute('data-changes-only');
      if (section?.dataset.change === 'removed' || changesOnly) section?.remove();
      else if (section) {
        section.dataset.change = 'unchanged';
        section.querySelector('.badge[class*="change-"]')?.remove();
        section.querySelector('.spec-change')?.remove();
        button.textContent = 'Accepted';
        button.removeAttribute('data-accept');
        button.removeAttribute('aria-label');
      }
      if (groups) regroup(groups);
      const pendingCount = document.querySelectorAll('section[data-change]:not([data-change="unchanged"])').length;
      const count = document.querySelector('#pending-count');
      if (count) count.textContent = String(pendingCount);
      const empty = document.querySelector<HTMLElement>('#changes-empty');
      if (empty) empty.hidden = pendingCount > 0;
      if (section?.isConnected) section.querySelector('summary')?.focus({ preventScroll: true });
      else {
        const next = groups?.querySelector<HTMLElement>('button[data-accept]') ?? document.querySelector<HTMLElement>('[aria-current="page"]');
        next?.focus({ preventScroll: true });
      }
      if (message) message.textContent = 'This specification change was accepted. Other changes remain for review.';
    } catch (error) {
      button.disabled = false;
      if (message) { message.textContent = error instanceof Error ? error.message : String(error); message.classList.add('error'); }
    }
  });
});

initialiseExecutionTabs();
initialiseFractalNavigation();

initialiseSupportingNavigation();

// Classifications are explicit human actions, independent of specification acceptance.
document.querySelectorAll<HTMLFormElement>('[data-decision-form]').forEach(form => {
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector<HTMLButtonElement>('button')!;
    const message = document.querySelector<HTMLElement>('#decision-message');
    button.disabled = true;
    try {
      const data = new FormData(form);
      const response = await fetch('/api/decisions/classify', { method: 'POST', headers: {
        'Content-Type': 'application/json', 'X-Agent-Intent-Token': token,
      }, body: JSON.stringify({
        revision: document.querySelector<HTMLMetaElement>('meta[name="decision-revision"]')?.content,
        id: form.closest<HTMLElement>('[data-decision-id]')?.dataset.decisionId,
        classification: data.get('classification'), scope: data.get('scope'), rationale: data.get('rationale'),
      }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw Error(result.error ?? 'Decision could not be recorded');
      window.location.reload();
    } catch (error) {
      button.disabled = false;
      if (message) { message.textContent = error instanceof Error ? error.message : String(error); message.classList.add('error'); }
    }
  });
});
