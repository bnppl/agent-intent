import { definitionParts } from './definition.js';
import type { LineageScenario } from './report.js';
export function lineageIds(tags: readonly string[]): string[] {
  return tags.filter(tag => !/^@(supports:|component:|req-\d+$|api$|frontend$|e2e$)/i.test(tag)).map(tag => tag.slice(1));
}
export interface SupportLink { child: string; parent: string; step: number }
/** Supports metadata never participates in test-result aggregation. Steps include backgrounds. */
export function supportingFeatures(scenarios: readonly LineageScenario[]): { links: SupportLink[]; diagnostics: Map<string, string[]> } {
  const links: SupportLink[] = [];
  const diagnostics = new Map<string, string[]>();
  const warn = (id: string, message: string) => diagnostics.set(id, [...diagnostics.get(id) ?? [], message]);
  for (const child of scenarios) for (const tag of child.tags.filter(tag => tag.startsWith('@supports:'))) {
    const match = /^@supports:([^:]+):([1-9]\d*)$/.exec(tag);
    if (!match) { warn(child.id, `Invalid supporting tag: ${tag}`); continue; }
    const parents = scenarios.filter(parent => parent.tags.includes('@' + match[1]));
    if (parents.length !== 1) { warn(child.id, `${parents.length ? 'Ambiguous' : 'Missing'} supporting target: ${tag}`); continue; }
    const parent = parents[0];
    const count = parent.definition ? definitionParts(parent.definition).filter(part => part.step).length : 0;
    const step = Number(match[2]);
    if (!Number.isSafeInteger(step) || step > count) { warn(child.id, `Step out of range: ${tag}`); continue; }
    if (!links.some(link => link.child === child.id && link.parent === parent.id && link.step === step)) links.push({ child: child.id, parent: parent.id, step });
  }
  const reaches = (start: string, target: string, seen = new Set<string>()): boolean => {
    if (start === target) return true;
    if (seen.has(start)) return false;
    seen.add(start);
    return links.filter(link => link.parent === start).some(link => reaches(link.child, target, seen));
  };
  const valid = links.filter(link => {
    if (!reaches(link.child, link.parent)) return true;
    warn(link.child, `Cyclic supporting relationship: ${link.parent}`); return false;
  });
  return { links: valid, diagnostics };
}

/** Move the original specification nodes: acceptance and evidence remain attached once. */
export function initialiseSupportingNavigation(): void {
  const library = document.querySelector<HTMLElement>('[data-support-library]');
  if (!library) return;
  const panels = [...document.querySelectorAll<HTMLElement>('[data-support-view]')];
  const history: { panel: HTMLElement; origin: HTMLElement; scroll: number; homes: Map<HTMLElement, Comment> }[] = [];
  function transition(update: () => void, animate = true): void {
    if (animate && document.startViewTransition && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) document.startViewTransition(update);
    else update();
  }
  function publish(): void {
    const trail = history.map(frame => {
      const parentId = frame.panel.dataset.supportParent ?? '';
      const parentName = document.getElementById(parentId)?.querySelector('summary h2')?.textContent ?? parentId;
      return { panelId: frame.panel.id, parentId, parentName };
    });
    library!.dataset.componentTrail = JSON.stringify(trail);
    document.dispatchEvent(new CustomEvent('agent-intent:components', { detail: { depth: history.length, trail } }));
  }
  function restore(depth: number): void {
    let last: typeof history[number] | undefined;
    while (history.length > depth) {
      const frame = history.pop()!;
      for (const [node, home] of frame.homes) home.replaceWith(node);
      frame.panel.hidden = true; last = frame;
    }
    if (history.length) history[history.length - 1].panel.hidden = false;
    else document.body.classList.remove('support-view-active');
    publish();
    if (last) { window.scrollTo({ top: last.scroll, behavior: 'instant' }); last.origin.focus({ preventScroll: true }); }
  }
  function open(panelId: string, origin?: HTMLElement): void {
    const panel = panels.find(panel => panel.id === panelId);
    if (!panel || history.some(frame => frame.panel === panel)) return;
    if (history.length) history[history.length - 1].panel.hidden = true;
    const frame = { panel, origin: origin ?? panel.querySelector<HTMLElement>('[data-support-back]')!, scroll: window.scrollY, homes: new Map<HTMLElement, Comment>() };
    history.push(frame);
    panel.querySelectorAll<HTMLElement>('[data-support-child]').forEach(slot => {
      const node = document.getElementById(slot.dataset.supportChild!);
      if (!node) return;
      const home = document.createComment('component specification'); node.replaceWith(home); frame.homes.set(node, home); slot.append(node);
      const fallback = slot.querySelector<HTMLAnchorElement>(':scope > a');
      if (fallback) fallback.hidden = true;
    });
    panel.hidden = false; document.body.classList.add('support-view-active');
    publish();
    (document.querySelector<HTMLElement>('[data-report-stack] [data-stack-back]') ?? panel.querySelector<HTMLElement>('[data-support-back]'))?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  panels.forEach(panel => {
    panel.hidden = true;
    panel.querySelector<HTMLAnchorElement>('[data-support-back]')?.addEventListener('click', event => {
      event.preventDefault(); transition(() => restore(Math.max(0, history.length - 1)));
    });
  });
  document.querySelectorAll<HTMLAnchorElement>('[data-support-link]').forEach(link => link.addEventListener('click', event => {
    const panelId = link.hash.slice(1);
    if (!panels.some(panel => panel.id === panelId)) return;
    event.preventDefault(); transition(() => open(panelId, link));
  }));
  document.addEventListener('agent-intent:component-command', event => {
    const command = (event as CustomEvent<{ action: string; panelId?: string; depth?: number; origin?: HTMLElement; animate?: boolean }>).detail;
    transition(() => {
      if (command.action === 'open' && command.panelId) open(command.panelId, command.origin);
      else if (command.action === 'back') restore(Math.max(0, history.length - 1));
      else if (command.action === 'close') restore(0);
      else if (command.action === 'to' && Number.isInteger(command.depth)) restore(Math.max(0, Math.min(history.length, command.depth!)));
    }, command.animate !== false);
  });
  library.hidden = true;
  publish();
}
