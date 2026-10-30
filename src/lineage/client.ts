import { regroup } from './grouping.js';
const token = document.querySelector<HTMLMetaElement>('meta[name="intent-dd-token"]')?.content ?? '';
const revision = document.querySelector<HTMLMetaElement>('meta[name="lineage-revision"]')?.content ?? '';
const message = document.querySelector<HTMLElement>('#lineage-message');

document.querySelectorAll<HTMLButtonElement>('button[data-accept]').forEach(button => {
  button.addEventListener('click', async () => {
    button.disabled = true;
    if (message) { message.textContent = ''; message.classList.remove('error'); }
    try {
      const response = await fetch('/api/lineage/accept', { method: 'POST', headers: {
        'Content-Type': 'application/json', 'X-IntentDD-Token': token,
      }, body: JSON.stringify({ revision, key: button.dataset.accept, expectedAcceptance: button.dataset.previous || null }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw Error(result.error ?? 'Acceptance failed. Reload the report and try again.');
      const section = button.closest<HTMLElement>('section');
      if (section?.dataset.change === 'removed') section.remove();
      else if (section) {
        section.dataset.change = 'unchanged';
        section.querySelector('.badge[class*="change-"]')?.remove();
        section.querySelector('.spec-change')?.remove();
        button.closest('.review-actions')?.remove();
      }
      const groups = document.querySelector<HTMLElement>('#scenario-groups');
      if (groups) regroup(groups);
      section?.querySelector('summary')?.focus({ preventScroll: true });
      if (message) message.textContent = 'This specification change was accepted. Other changes remain for review.';
    } catch (error) {
      button.disabled = false;
      if (message) { message.textContent = error instanceof Error ? error.message : String(error); message.classList.add('error'); }
    }
  });
});
