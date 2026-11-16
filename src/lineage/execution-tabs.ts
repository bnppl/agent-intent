/** Keep each example and retry's evidence together, with native keyboard tab semantics. */
export function initialiseExecutionTabs(): void {
  document.querySelectorAll<HTMLElement>('[data-execution-tabs]').forEach(group => {
    const tabs = [...group.querySelectorAll<HTMLButtonElement>(':scope > [role="tablist"] > [role="tab"]')];
    const panels = [...group.querySelectorAll<HTMLElement>(':scope > [role="tabpanel"]')];
    function select(index: number, focus = false): void {
      tabs.forEach((tab, current) => {
        tab.setAttribute('aria-selected', String(index === current));
        tab.tabIndex = index === current ? 0 : -1;
      });
      panels.forEach((panel, current) => { panel.hidden = current !== index; });
      if (focus) tabs[index].focus();
    }
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', event => { event.stopPropagation(); select(index); });
      tab.addEventListener('keydown', event => {
        let next: number;
        if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
        else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = tabs.length - 1;
        else return;
        event.preventDefault(); event.stopPropagation(); select(next, true);
      });
    });
    select(0);
  });
}
