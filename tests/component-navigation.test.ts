import { it } from 'node:test';
import assert from 'node:assert/strict';
import { initialiseStackNavigation } from '../src/lineage/stack-navigation.js';
import { initialiseSupportingNavigation } from '../src/lineage/supports.js';

class Node {
  open = false;
  attributes = new Map<string, string>();
  hidden = false;
  focused = false;
  dataset: Record<string, string> = {};
  children: Node[] = [];
  parent?: Node;
  id = '';
  textContent = '';
  listeners = new Map<string, ((event: { preventDefault(): void }) => void)[]>();
  queries = new Map<string, Node>();
  groups = new Map<string, Node[]>();
  querySelector(selector: string) { return this.queries.get(selector) ?? this.children.find(child => selector === '[aria-current]' && child.hasAttribute('aria-current')) ?? this.children.flatMap(child => child.children).find(child => selector === '[aria-current]' && child.hasAttribute('aria-current')) ?? null; }
  closest(selector: string) { return this.queries.get('closest:' + selector) ?? null; }
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  getAttribute(name: string) { return this.attributes.get(name) ?? null; }
  hasAttribute(name: string) { return this.attributes.has(name); }
  removeAttribute(name: string) { this.attributes.delete(name); }
  toggleAttribute(name: string, active: boolean) { if (active) this.attributes.set(name, ''); else this.attributes.delete(name); }
  replaceChildren(...nodes: Node[]) { this.children = nodes; }
  click() { this.listeners.get('click')?.forEach(listener => listener({ preventDefault() {}, target: this } as never)); }
  querySelectorAll(selector: string) { return this.groups.get(selector) ?? []; }
  addEventListener(name: string, listener: (event: { preventDefault(): void }) => void) { this.listeners.set(name, [...this.listeners.get(name) ?? [], listener]); }
  focus() { this.focused = true; }
  append(node: Node) { if (node.parent) node.parent.children.splice(node.parent.children.indexOf(node), 1); this.children.push(node); node.parent = this; }
  replaceWith(node: Node) { assert.ok(this.parent); const parent = this.parent; parent.children[parent.children.indexOf(this)] = node; node.parent = parent; this.parent = undefined; }
}

it('shared component navigation restores original nodes, nested history, focus and scroll', () => {
  const previousDocument = globalThis.document, previousWindow = globalThis.window;
  const library = new Node(), first = new Node(), second = new Node(), parent = new Node(), child = new Node(), nested = new Node();
  first.id = 'first'; second.id = 'second'; parent.id = 'parent'; child.id = 'child'; nested.id = 'nested';
  first.dataset.supportParent = 'parent'; second.dataset.supportParent = 'child';
  const origin = new Node(), nestedOrigin = new Node();
  const slot = new Node(), nestedSlot = new Node(); slot.dataset.supportChild = 'child'; nestedSlot.dataset.supportChild = 'nested';
  first.groups.set('[data-support-child]', [slot]); second.groups.set('[data-support-child]', [nestedSlot]);
  first.queries.set('[data-support-back]', new Node()); second.queries.set('[data-support-back]', new Node());
  library.append(child); library.append(nested);
  const target = new EventTarget();
  const elements = new Map([first, second, parent, child, nested].map(node => [node.id, node]));
  let scroll = 12, transitions = 0;
  const states: { depth: number }[] = [];
  target.addEventListener('agent-intent:components', event => states.push((event as CustomEvent).detail));
  const fakeDocument = Object.assign(target, {
    querySelector: () => library,
    querySelectorAll: (selector: string) => selector === '[data-support-view]' ? [first, second] : [],
    getElementById: (id: string) => elements.get(id) ?? null,
    createComment: () => new Node(),
    body: { classList: { add() {}, remove() {} } },
    startViewTransition: (update: () => void) => { transitions++; update(); },
  });
  const fakeWindow = { get scrollY() { return scroll; }, scrollTo: ({ top }: { top: number }) => { scroll = top; }, matchMedia: () => ({ matches: false }) };
  Object.assign(globalThis, { document: fakeDocument, window: fakeWindow });
  const command = (detail: object) => target.dispatchEvent(new CustomEvent('agent-intent:component-command', { detail }));
  try {
    initialiseSupportingNavigation();
    command({ action: 'open', panelId: 'first', origin });
    assert.equal(slot.children[0], child, 'opening a component moves its existing evidence node');
    assert.equal(first.hidden, false); assert.equal(scroll, 0);
    scroll = 81;
    command({ action: 'open', panelId: 'second', origin: nestedOrigin });
    assert.equal(nestedSlot.children[0], nested); assert.equal(first.hidden, true);
    command({ action: 'back' });
    assert.equal(nested.parent, library); assert.equal(first.hidden, false); assert.equal(scroll, 81); assert.equal(nestedOrigin.focused, true);
    command({ action: 'close', animate: false });
    assert.equal(child.parent, library); assert.equal(scroll, 12); assert.equal(origin.focused, true);
    assert.deepEqual(states.map(state => state.depth), [0, 1, 2, 1, 0]);
    assert.equal(transitions, 3, 'explicit opens/back animate; coordinated close does not');
  } finally { Object.assign(globalThis, { document: previousDocument, window: previousWindow }); }
});

it('outline and shared breadcrumbs navigate full context while preserving expanded step evidence and reduced motion', () => {
  const previousDocument = globalThis.document, previousWindow = globalThis.window;
  const root = new Node(), back = new Node(), crumbs = new Node(), content = new Node(), toggle = new Node();
  const requirement = new Node(), otherRequirement = new Node(), specification = new Node(), otherSpecification = new Node(), stepLogs = new Node();
  stepLogs.open = true; specification.append(stepLogs);
  const wrapper = new Node(), otherWrapper = new Node(), section = new Node(), otherSection = new Node();
  wrapper.dataset.requirement = 'req-1'; otherWrapper.dataset.requirement = 'req-2'; section.id = 'scenario-1'; otherSection.id = 'scenario-2';
  requirement.queries.set('closest:[data-requirement]', wrapper); otherRequirement.queries.set('closest:[data-requirement]', otherWrapper);
  specification.queries.set('closest:.requirement-level', requirement); specification.queries.set('closest:section', section);
  otherSpecification.queries.set('closest:.requirement-level', otherRequirement); otherSpecification.queries.set('closest:section', otherSection);
  for (const [node, label] of [[requirement, 'First requirement'], [otherRequirement, 'Other requirement'], [specification, 'End-to-end scenario']] as const) { const heading = new Node(); heading.textContent = label; node.queries.set('summary h2', heading); }
  const home = new Node(), requirementButton = new Node(), scenarioButton = new Node(), componentsButton = new Node();
  home.setAttribute('data-outline-home', ''); requirementButton.dataset.outlineRequirement = 'req-2'; scenarioButton.dataset.outlineScenario = 'scenario-1'; componentsButton.dataset.outlineComponents = 'components-1'; componentsButton.dataset.outlineParent = 'scenario-1';
  const outlineSelector = '[data-outline-home], [data-outline-requirement], [data-outline-scenario], [data-outline-components]';
  root.groups.set(outlineSelector, [home, requirementButton, scenarioButton, componentsButton]);
  root.groups.set('.requirement-level', [requirement, otherRequirement]); root.groups.set('.specification-level', [specification, otherSpecification]); root.groups.set('[data-support-view]', []);
  root.queries.set('[data-stack-back]', back); root.queries.set('[data-stack-crumbs]', crumbs); root.queries.set('[data-stack-content]', content); root.queries.set('[data-outline-toggle]', toggle);
  const target = new EventTarget();
  const commands: { action: string }[] = [];
  target.addEventListener('agent-intent:component-command', event => {
    const command = (event as CustomEvent).detail; commands.push(command);
    const trail = command.action === 'open' ? [{ panelId: 'components-1', parentId: 'scenario-1', parentName: 'End-to-end scenario' }] : [];
    target.dispatchEvent(new CustomEvent('agent-intent:components', { detail: { trail } }));
  });
  const fakeDocument = Object.assign(target, { querySelector: () => root, createElement: () => new Node(), startViewTransition: () => { throw Error('Reduced motion must not start a transition'); } });
  Object.assign(globalThis, { document: fakeDocument, window: { scrollY: 42, scrollTo() {}, matchMedia: () => ({ matches: true }) } });
  try {
    initialiseStackNavigation();
    assert.equal(home.getAttribute('aria-current'), 'page');
    toggle.click(); assert.equal(root.hasAttribute('data-outline-open'), true);
    scenarioButton.click();
    assert.equal(requirement.open, true); assert.equal(specification.open, true); assert.equal(stepLogs.open, true); assert.equal(stepLogs.parent, specification);
    assert.equal(root.hasAttribute('data-outline-open'), false); assert.equal(toggle.getAttribute('aria-expanded'), 'false');
    assert.equal(scenarioButton.getAttribute('aria-current'), 'page');
    componentsButton.click();
    assert.deepEqual(crumbs.children.map(item => item.children[0].textContent), ['Project intent', 'First requirement', 'End-to-end scenario', 'Components']);
    assert.equal(componentsButton.getAttribute('aria-current'), 'page');
    back.click(); assert.equal(commands.at(-1)?.action, 'back');
    requirementButton.click(); assert.equal(otherRequirement.open, true); assert.equal(requirement.open, false); assert.equal(specification.open, false); assert.equal(stepLogs.open, true);
  } finally { Object.assign(globalThis, { document: previousDocument, window: previousWindow }); }
});

it('drills beyond components into a feature, scenario and step, then returns one level at a time', { tags: ['component-depth-navigation', 'step-evidence-drilldown'] }, () => {
  const previousDocument = globalThis.document, previousWindow = globalThis.window;
  const root = new Node(), back = new Node(), crumbs = new Node(), content = new Node();
  const panel = new Node(), feature = new Node(), featureButton = new Node(), scenario = new Node(), summary = new Node(), title = new Node(), step = new Node(), stepSummary = new Node();
  panel.id = 'components'; featureButton.textContent = 'Catalogue API'; title.textContent = 'List toys'; stepSummary.textContent = 'Given a catalogue request';
  feature.queries.set('[data-drill-feature]', featureButton); feature.queries.set('closest:[data-support-view]', panel);
  scenario.queries.set('summary', summary); scenario.queries.set('summary h2', title); scenario.queries.set('closest:.support-feature', feature); scenario.queries.set('closest:[data-support-view]', panel);
  step.queries.set('summary', stepSummary); step.queries.set('closest:[data-support-view]', panel); step.queries.set('closest:.specification-level', scenario);
  root.groups.set('.requirement-level', []); root.groups.set('.specification-level', [scenario]); root.groups.set('[data-support-view]', [panel]); root.groups.set('.support-feature', [feature]); root.groups.set('.step-evidence', [step]);
  root.queries.set('[data-stack-back]', back); root.queries.set('[data-stack-crumbs]', crumbs); root.queries.set('[data-stack-content]', content);
  const target = new EventTarget();
  Object.assign(globalThis, { document: Object.assign(target, { querySelector: () => root, createElement: () => new Node() }), window: { scrollY: 0, scrollTo() {}, matchMedia: () => ({ matches: true }) } });
  const labels = () => crumbs.children.map(item => item.children[0].textContent);
  try {
    initialiseStackNavigation();
    target.dispatchEvent(new CustomEvent('agent-intent:components', { detail: { trail: [{ panelId: panel.id, parentId: 'parent', parentName: 'Choose toys' }] } }));
    featureButton.click();
    assert.equal(labels().at(-1), 'Catalogue API', 'a component feature becomes a new report level');
    summary.click(); assert.equal(labels().at(-1), 'List toys');
    stepSummary.click(); assert.equal(labels().at(-1), 'Given a catalogue request');
    assert.equal(step.open, true);
    back.click(); assert.equal(labels().at(-1), 'List toys');
    assert.equal(step.open, false, 'returning to the scenario hides step logs');
    back.click(); assert.equal(labels().at(-1), 'Catalogue API');
    back.click(); assert.equal(labels().at(-1), 'Components');
    assert.equal(feature.hasAttribute('data-drill-active'), false);
  } finally { Object.assign(globalThis, { document: previousDocument, window: previousWindow }); }
});
