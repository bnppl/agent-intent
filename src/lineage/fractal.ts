/** Native details expand inline; title links focus the same spec subtree via a shareable URL. */
export function initialiseFractalNavigation(): void {
  const root = document.querySelector<HTMLElement>('[data-fractal-report]');
  if (!root) return;
  const content = root.querySelector<HTMLElement>('[data-stack-content]')!;
  const stage = document.createElement('div');
  stage.className = 'focused-specification';
  content.after(stage);
  const back = root.querySelector<HTMLButtonElement>('[data-stack-back]')!;
  const crumbs = root.querySelector<HTMLElement>('[data-stack-crumbs]')!;
  let active: HTMLElement | undefined;
  let home: Comment | undefined;
  let wasOpen = false;
  let scroll = 0;
  let navigated = false;
  const focusable = 'section, [data-requirement], [data-unit-spec], .step-evidence, [data-component-spec]';
  const detailFor = (node: HTMLElement) => node.matches('details') ? node as HTMLDetailsElement : node.querySelector<HTMLDetailsElement>(':scope > details');
  const label = (node: HTMLElement) => node.querySelector(':scope > summary [data-spec-title], :scope > h3 [data-spec-title], :scope > details > summary [data-spec-title]')?.textContent ?? 'Specification';
  function show(): void {
    if (active && home) {
      const detail = detailFor(active);
      if (detail) detail.open = wasOpen;
      home.replaceWith(active);
      active = undefined; home = undefined;
    }
    let id = '';
    try { if (location.hash.startsWith('#spec=')) id = decodeURIComponent(location.hash.slice(6)); } catch { /* Invalid deep links show the project. */ }
    const target = id ? document.getElementById(id) : null;
    active = target && root!.contains(target) && target.matches(focusable) ? target : undefined;
    content.hidden = !!active;
    stage.hidden = !active;
    stage.replaceChildren();
    crumbs.replaceChildren();
    const item = document.createElement('li');
    const project = document.createElement('a'); project.href = '#'; project.textContent = 'Project intent'; item.append(project); crumbs.append(item);
    if (active) {
      const trail: HTMLElement[] = [];
      for (let parent = active.parentElement; parent && parent !== content; parent = parent.parentElement) {
        if (parent.matches(focusable)) trail.unshift(parent);
      }
      for (const node of [...trail, active]) {
        const entry = document.createElement('li');
        const link = document.createElement('a'); link.href = '#spec=' + encodeURIComponent(node.id); link.textContent = label(node);
        if (node === active) link.setAttribute('aria-current', 'page');
        entry.append(link); crumbs.append(entry);
      }
      home = document.createComment('focused specification');
      active.replaceWith(home); stage.append(active);
      const detail = detailFor(active);
      wasOpen = detail?.open ?? false;
      if (detail) detail.open = true;
    }
    back.disabled = !active;
    window.scrollTo({ top: active ? 0 : scroll, behavior: 'instant' });
  }
  root.querySelectorAll<HTMLAnchorElement>('[data-spec-title]').forEach(link => link.addEventListener('click', event => {
    event.stopPropagation();
    scroll = window.scrollY; navigated = true;
  }));
  root.querySelectorAll<HTMLButtonElement>('[data-outline-home], [data-outline-requirement], [data-outline-scenario], [data-outline-components]').forEach(button => button.addEventListener('click', () => {
    navigated = true;
    const id = button.dataset.outlineRequirement ?? button.dataset.outlineScenario ?? button.dataset.outlineParent;
    location.hash = id ? 'spec=' + encodeURIComponent(id) : '';
  }));
  back.addEventListener('click', () => {
    if (!active) return;
    if (navigated) history.back(); else location.hash = '';
  });
  const toggle = root.querySelector<HTMLButtonElement>('[data-outline-toggle]');
  toggle?.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(expanded));
    root.toggleAttribute('data-outline-open', expanded);
  });
  window.addEventListener('hashchange', show);
  root.setAttribute('data-fractal-ready', '');
  show();
}
