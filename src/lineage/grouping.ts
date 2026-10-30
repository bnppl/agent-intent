export const runGroups = [['failed', 'Failed'], ['passed', 'Passed'], ['not-run', 'Not run']] as const;
export const changeGroups = [['added', 'Added'], ['modified', 'Changed'], ['unchanged', 'Unchanged'], ['removed', 'Removed']] as const;
export function groupCount(count: number): string { return `${count} specification${count === 1 ? '' : 's'}`; }

interface Row { result: string; change: string; html: string }

export function groupRows(rows: readonly Row[]): string {
  return runGroups.map(([result, label]) => {
    const matching = rows.filter(row => row.result === result);
    if (!matching.length) return '';
    const children = changeGroups.map(([change, changeLabel]) => {
      const subset = matching.filter(row => row.change === change);
      return subset.length ? `<div class="change-group" data-change-group="${change}" role="group" aria-label="${changeLabel}"><div class="change-group-title">${changeLabel} <span data-group-count>${groupCount(subset.length)}</span></div>${subset.map(row => row.html).join('\n')}</div>` : '';
    }).join('\n');
    return `<div class="run-group" data-run-group="${result}" role="group" aria-label="${label}"><div class="run-group-title">${label} <span data-group-count>${groupCount(matching.length)}</span></div>${children}</div>`;
  }).join('\n');
}

/** Move existing nodes so their disclosure state and event handlers survive acceptance. */
export function regroup(root: HTMLElement): void {
  const rows = [...root.querySelectorAll<HTMLElement>('section[data-result][data-change]')];
  const groups: HTMLElement[] = [];
  function group(kind: 'run' | 'change', state: string, label: string, count: number): HTMLElement {
    const element = document.createElement('div');
    element.className = `${kind}-group`; element.setAttribute(`data-${kind}-group`, state);
    element.setAttribute('role', 'group'); element.setAttribute('aria-label', label);
    const title = document.createElement('div'); title.className = `${kind}-group-title`;
    title.append(label + ' ');
    const total = document.createElement('span'); total.setAttribute('data-group-count', ''); total.textContent = groupCount(count);
    title.append(total); element.append(title); return element;
  }
  for (const [result, label] of runGroups) {
    const matching = rows.filter(row => row.dataset.result === result);
    if (!matching.length) continue;
    const parent = group('run', result, label, matching.length);
    for (const [change, changeLabel] of changeGroups) {
      const subset = matching.filter(row => row.dataset.change === change);
      if (!subset.length) continue;
      const child = group('change', change, changeLabel, subset.length);
      child.append(...subset); parent.append(child);
    }
    groups.push(parent);
  }
  root.replaceChildren(...groups);
}
