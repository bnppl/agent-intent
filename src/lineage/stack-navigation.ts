/** Shared progressive enhancement for served and standalone reports. Self-contained for HTML export. */
export function initialiseStackNavigation(): void {
  const root = document.querySelector<HTMLElement>('[data-report-stack]');
  if (!root) return;
  const back = root.querySelector<HTMLButtonElement>('[data-stack-back]')!;
  const crumbs = root.querySelector<HTMLElement>('[data-stack-crumbs]')!;
  const content = root.querySelector<HTMLElement>('[data-stack-content]')!;
  const outlineToggle = root.querySelector<HTMLButtonElement>('[data-outline-toggle]');
  const requirements = [...root.querySelectorAll<HTMLDetailsElement>('.requirement-level')];
  const specifications = [...root.querySelectorAll<HTMLDetailsElement>('.specification-level')];
  const panels = [...root.querySelectorAll<HTMLElement>('[data-support-view]')];
  const position = [0, 0, 0];
  let depth = 0;
  let navigating = false;
  type ComponentFrame = { panelId: string; parentId: string; parentName: string };
  let components: ComponentFrame[] = JSON.parse(root.querySelector<HTMLElement>('[data-support-library]')?.dataset.componentTrail ?? '[]');
  type DetailFrame = { node: HTMLElement; label: string; kind: 'feature' | 'scenario' | 'step'; componentDepth: number; scroll: number; origin: HTMLElement; wasOpen?: boolean };
  const details: DetailFrame[] = [];
  function trimDetails(keep: number): void {
    while (details.length > keep) {
      const frame = details.pop()!;
      frame.node.removeAttribute('data-drill-active');
      if (frame.kind !== 'feature') (frame.node as HTMLDetailsElement).open = frame.kind === 'scenario' && !!frame.wasOpen;
      window.scrollTo({ top: frame.scroll, behavior: 'instant' });
      frame.origin.focus({ preventScroll: true });
    }
  }
  function enter(node: HTMLElement, kind: DetailFrame['kind'], label: string, origin: HTMLElement): void {
    if (details.some(frame => frame.node === node)) return;
    const frame: DetailFrame = { node, kind, label, componentDepth: components.length, scroll: window.scrollY, origin };
    if (kind !== 'feature') { frame.wasOpen = (node as HTMLDetailsElement).open; (node as HTMLDetailsElement).open = true; }
    details.push(frame); node.setAttribute('data-drill-active', '');
    update(); collapseOutline(); window.scrollTo({ top: 0, behavior: 'instant' }); back.focus({ preventScroll: true });
  }
  function current() {
    const requirement = requirements.find(item => item.open);
    const specification = requirement ? specifications.find(item => item.open && item.closest('.requirement-level') === requirement) : undefined;
    return { requirement, specification };
  }
  function command(detail: object): void {
    document.dispatchEvent(new CustomEvent('agent-intent:component-command', { detail: { ...detail, animate: false } }));
  }
  function transition(update: () => void): void {
    if (document.startViewTransition && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) document.startViewTransition(update);
    else update();
  }
  function collapseOutline(): void {
    root!.removeAttribute('data-outline-open');
    outlineToggle?.setAttribute('aria-expanded', 'false');
  }
  function renderDetailOutline(): void {
    const nav = root!.querySelector<HTMLElement>('#report-outline');
    if (!nav) return;
    nav.querySelector('[data-outline-detail]')?.remove();
    if (!components.length && !details.length) return;
    const branch = document.createElement('div'); branch.setAttribute('data-outline-detail', ''); branch.className = 'outline-scenario';
    const add = (label: string, action: () => void, active = false, kind = 'feature'): HTMLButtonElement => {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.setAttribute('data-outline-kind', kind);
      if (active) button.setAttribute('aria-current', 'page');
      button.addEventListener('click', () => transition(action)); branch.append(button); return button;
    };
    const activePanel = panels.find(panel => panel.id === components.at(-1)?.panelId);
    const currentDetails = details.filter(frame => frame.componentDepth === components.length);
    const featureFrame = currentDetails.find(frame => frame.kind === 'feature');
    let scenarioEntry: HTMLButtonElement | undefined;
    let lastComponent = '';
    activePanel?.querySelectorAll<HTMLElement>('.support-feature').forEach(feature => {
      const componentName = feature.dataset.componentName ?? '';
      if (componentName && componentName !== lastComponent) {
        const heading = document.createElement('p'); heading.className = 'outline-component-name'; heading.textContent = componentName;
        branch.append(heading); lastComponent = componentName;
      }
      const heading = feature.querySelector<HTMLElement>('[data-drill-feature]')!;
      add(heading.childNodes[0]?.textContent?.trim() || heading.textContent || 'Component', () => {
        const first = details.findIndex(frame => frame.componentDepth === components.length);
        if (first >= 0) trimDetails(first);
        enter(feature, 'feature', heading.childNodes[0]?.textContent?.trim() || 'Component', heading);
      }, featureFrame?.node === feature && currentDetails.length === 1);
      if (featureFrame?.node === feature) feature.querySelectorAll<HTMLDetailsElement>('.specification-level').forEach(scenario => {
        const title = scenario.querySelector('summary h2')?.textContent ?? 'Scenario';
        const entry = add(title, () => {
          const index = details.indexOf(featureFrame); trimDetails(index + 1);
          enter(scenario, 'scenario', title, scenario.querySelector<HTMLElement>('summary')!);
        }, currentDetails.at(-1)?.node === scenario, 'scenario');
        if (currentDetails.some(frame => frame.node === scenario)) scenarioEntry = entry;
      });
    });
    const scenarioFrame = currentDetails.find(frame => frame.kind === 'scenario');
    const activeScenario = scenarioFrame?.node ?? (activePanel ? undefined : current().specification);
    const stepEntries: HTMLButtonElement[] = [];
    activeScenario?.querySelectorAll<HTMLDetailsElement>('.step-evidence').forEach(step => {
      const summary = step.querySelector<HTMLElement>('summary')!;
      const label = summary.querySelector('.step-text')?.textContent?.trim().split('\n')[0] || 'Step evidence';
      const entry = add(label, () => {
        const index = scenarioFrame ? details.indexOf(scenarioFrame) + 1 : 0;
        trimDetails(index); enter(step, 'step', label, summary);
      }, currentDetails.at(-1)?.node === step, 'step');
      stepEntries.push(entry);
    });
    scenarioEntry?.after(...stepEntries);
    const componentButton = [...nav.querySelectorAll<HTMLElement>('[data-outline-components]')].find(button => button.dataset.outlineComponents === activePanel?.id);
    (componentButton?.parentElement ?? nav).append(branch);
  }
  function update(): void {
    const { requirement, specification } = current();
    const next = specification ? 2 : requirement ? 1 : 0;
    back.disabled = next === 0 && !components.length;
    crumbs.replaceChildren();
    const labels = ['Project intent', requirement?.querySelector('summary h2')?.textContent ?? '', specification?.querySelector('summary h2')?.textContent ?? ''].slice(0, next + 1);
    const destinations: (() => void)[] = labels.map((_, index) => () => go(index));
    const appendDetails = (level: number): void => {
      details.forEach((frame, index) => {
        if (frame.componentDepth !== level) return;
        labels.push(frame.label);
        destinations.push(() => {
          command({ action: 'to', depth: level }); trimDetails(index + 1); update();
        });
      });
    };
    appendDetails(0);
    components.forEach((frame, index) => {
      labels.push(index ? `${frame.parentName} · Components` : 'Components');
      destinations.push(() => {
        command({ action: 'to', depth: index + 1 });
        const first = details.findIndex(item => item.componentDepth >= index + 1);
        if (first >= 0) trimDetails(first);
        update();
      });
      appendDetails(index + 1);
    });
    labels.forEach((label, index) => {
      const item = document.createElement('li');
      const last = index === labels.length - 1;
      const element = document.createElement(last ? 'span' : 'button');
      element.textContent = label; element.title = label;
      if (last) { element.setAttribute('aria-current', 'page'); element.tabIndex = -1; }
      else {
        element.setAttribute('type', 'button'); element.setAttribute('data-stack-depth', String(index));
        element.addEventListener('click', () => transition(destinations[index]));
      }
      item.append(element); crumbs.append(item);
    });
    panels.forEach(panel => {
      panel.toggleAttribute('data-feature-depth', details.some(frame => frame.kind === 'feature' && frame.node.closest('[data-support-view]') === panel));
    });
    renderDetailOutline();
    root!.querySelectorAll<HTMLElement>('[data-outline-home], [data-outline-requirement], [data-outline-scenario], [data-outline-components]').forEach(item => {
      const active = components.length ? item.dataset.outlineComponents === components.at(-1)?.panelId
        : specification ? item.dataset.outlineScenario === specification.closest('section')?.id
        : requirement ? item.dataset.outlineRequirement === requirement.closest<HTMLElement>('[data-requirement]')?.dataset.requirement
        : item.hasAttribute('data-outline-home');
      if (active && !details.length) item.setAttribute('aria-current', 'page'); else item.removeAttribute('aria-current');
    });
    if (next !== depth && !navigating && !components.length) {
      position[depth] = window.scrollY;
      window.scrollTo({ top: position[next] ?? 0, behavior: 'instant' });
      (back.disabled ? crumbs.querySelector<HTMLElement>('[aria-current]') : back)?.focus({ preventScroll: true });
    }
    depth = next; content.dataset.depth = String(next);
  }
  function go(target: number): void {
    transition(() => {
      navigating = true;
      trimDetails(0); command({ action: 'close' });
      const { requirement, specification } = current();
      position[depth] = window.scrollY;
      if (target < 2 && specification) specification.open = false;
      if (target < 1 && requirement) requirement.open = false;
      update(); navigating = false;
      window.scrollTo({ top: position[target] ?? 0, behavior: 'instant' });
      (back.disabled ? crumbs.querySelector<HTMLElement>('[aria-current]') : back)?.focus({ preventScroll: true });
      collapseOutline();
    });
  }
  function selectScenario(id: string, visited = new Set<string>()): void {
    if (visited.has(id)) return;
    visited.add(id);
    const specification = specifications.find(item => item.closest('section')?.id === id);
    if (!specification) return;
    const requirement = specification.closest<HTMLDetailsElement>('.requirement-level');
    if (requirement) {
      requirements.forEach(item => { item.open = item === requirement; });
      specifications.filter(item => item.closest('.requirement-level')).forEach(item => { item.open = item === specification; });
    } else {
      const parentPanel = panels.find(panel => [...panel.querySelectorAll<HTMLElement>('[data-support-child]')].some(slot => slot.dataset.supportChild === id));
      if (parentPanel?.dataset.supportParent) {
        selectScenario(parentPanel.dataset.supportParent, visited);
        command({ action: 'open', panelId: parentPanel.id, origin: back });
      }
    }
    specification.open = true;
  }
  function selectOutline(button: HTMLElement): void {
    transition(() => {
      navigating = true;
      position[depth] = window.scrollY;
      trimDetails(0); command({ action: 'close' });
      if (button.hasAttribute('data-outline-home')) {
        specifications.forEach(item => { item.open = false; }); requirements.forEach(item => { item.open = false; });
      } else if (button.dataset.outlineRequirement !== undefined) {
        specifications.filter(item => item.closest('.requirement-level')).forEach(item => { item.open = false; });
        requirements.forEach(item => { item.open = item.closest<HTMLElement>('[data-requirement]')?.dataset.requirement === button.dataset.outlineRequirement; });
      } else {
        const id = button.dataset.outlineParent ?? button.dataset.outlineScenario;
        if (id) selectScenario(id);
        if (button.dataset.outlineComponents) command({ action: 'open', panelId: button.dataset.outlineComponents, origin: back });
      }
      update(); navigating = false; collapseOutline();
      window.scrollTo({ top: 0, behavior: 'instant' });
      (back.disabled ? crumbs.querySelector<HTMLElement>('[aria-current]') : back)?.focus({ preventScroll: true });
    });
  }
  back.addEventListener('click', () => {
    if (details.at(-1)?.componentDepth === components.length) transition(() => { trimDetails(details.length - 1); update(); });
    else if (components.length) transition(() => command({ action: 'back' }));
    else go(Math.max(0, depth - 1));
  });
  requirements.forEach(element => {
    element.addEventListener('toggle', update);
    element.querySelector('summary')?.addEventListener('click', event => {
      if ((event.target as HTMLElement).closest('a, button')) return;
      event.preventDefault(); transition(() => { position[depth] = window.scrollY; navigating = true; element.open = !element.open; update(); navigating = false; window.scrollTo({ top: 0, behavior: 'instant' }); (back.disabled ? crumbs.querySelector<HTMLElement>('[aria-current]') : back)?.focus({ preventScroll: true }); });
    });
  });
  specifications.forEach(element => {
    element.addEventListener('toggle', update);
    element.querySelector('summary')?.addEventListener('click', event => {
      if ((event.target as HTMLElement).closest('a, button')) return;
      event.preventDefault();
      if (element.closest('[data-support-view]')) {
        transition(() => enter(element, 'scenario', element.querySelector('summary h2')?.textContent ?? 'Scenario', element.querySelector<HTMLElement>('summary')!));
      } else transition(() => { position[depth] = window.scrollY; navigating = true; element.open = !element.open; update(); navigating = false; window.scrollTo({ top: 0, behavior: 'instant' }); (back.disabled ? crumbs.querySelector<HTMLElement>('[aria-current]') : back)?.focus({ preventScroll: true }); });
    });
  });
  root.querySelectorAll<HTMLElement>('.support-feature').forEach(feature => {
    const button = feature.querySelector<HTMLElement>('[data-drill-feature]');
    button?.addEventListener('click', () => transition(() => enter(feature, 'feature', button.childNodes?.[0]?.textContent?.trim() || button.textContent?.trim() || 'Component', button)));
  });
  root.querySelectorAll<HTMLDetailsElement>('.step-evidence').forEach(step => {
    const summary = step.querySelector<HTMLElement>('summary');
    summary?.addEventListener('click', event => {
      if ((event.target as HTMLElement)?.closest('a, button')) return;
      event.preventDefault();
      transition(() => enter(step, 'step', summary.querySelector('.step-text')?.textContent?.trim() || summary.textContent?.trim() || 'Step evidence', summary));
    });
  });
  root.querySelectorAll<HTMLElement>('[data-outline-home], [data-outline-requirement], [data-outline-scenario], [data-outline-components]').forEach(button => button.addEventListener('click', () => selectOutline(button)));
  outlineToggle?.addEventListener('click', () => {
    const expanded = outlineToggle.getAttribute('aria-expanded') !== 'true';
    outlineToggle.setAttribute('aria-expanded', String(expanded)); root.toggleAttribute('data-outline-open', expanded);
  });
  document.addEventListener('agent-intent:components', event => {
    components = (event as CustomEvent<{ trail: ComponentFrame[] }>).detail.trail;
    const first = details.findIndex(frame => frame.componentDepth > components.length);
    if (first >= 0) trimDetails(first);
    update();
  });
  root.setAttribute('data-navigation-ready', '');
  update();
}
