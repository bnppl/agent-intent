/** Execute the exported selection script against a small DOM adapter.
 * This checks event behaviour without claiming browser layout or native clipboard coverage.
 */
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';

class Control {
  textContent = '';
  value = '';
  checked = false;
  disabled = false;
  focused = false;
  selected = false;
  selection?: [number, number];
  dataset: Record<string, string> = {};
  private listeners = new Map<string, Array<() => unknown>>();
  addEventListener(event: string, listener: () => unknown): void {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener]);
  }
  async trigger(event: string): Promise<void> {
    for (const listener of this.listeners.get(event) ?? []) await listener();
  }
  focus(): void { this.focused = true; }
  select(): void { this.selected = true; }
  setSelectionRange(start: number, end: number): void { this.selection = [start, end]; }
}
function unescapeAttribute(value: string): string {
  return value.replaceAll('&quot;', '"').replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');
}
export class StaticReviewDriver {
  readonly choices: Control[];
  readonly controls = new Map<string, Control>();
  readonly window = new Control();
  copied: string[] = [];
  constructor(html: string, clipboard: 'available' | 'missing' | 'denied' = 'available') {
    for (const id of ['review-data','approval-text','copy-approvals','clear-approvals','approval-summary','copy-message']) {
      this.controls.set(id, new Control());
    }
    const data = html.match(/<script id="review-data" type="application\/json">(.*?)<\/script>/s);
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
    assert.ok(data); assert.equal(scripts.length, 1);
    this.control('review-data').textContent = data[1];
    this.choices = [...html.matchAll(/<input type="checkbox" data-review-key="([^"]*)">/g)].map(match => {
      const control = new Control(); control.dataset.reviewKey = unescapeAttribute(match[1]); return control;
    });
    assert.ok(this.choices.length > 0);
    runInNewContext(scripts[0][1], {
      document: {
        getElementById: (id: string) => this.control(id),
        querySelectorAll: (selector: string) => {
          assert.equal(selector, 'input[data-review-key]'); return this.choices;
        },
      },
      navigator: clipboard === 'missing' ? {} : {clipboard:{writeText: async (text: string) => {
        if (clipboard === 'denied') throw Error('Permission denied');
        this.copied.push(text);
      }}},
      window: this.window,
    }, {timeout:1000});
  }
  control(id: string): Control { const control = this.controls.get(id); assert.ok(control, 'Missing control: '+id); return control; }
  async select(index: number, checked = true): Promise<void> {
    this.choices[index].checked = checked; await this.choices[index].trigger('change');
  }
  async copy(): Promise<void> { await this.control('copy-approvals').trigger('click'); }
  async clear(): Promise<void> { await this.control('clear-approvals').trigger('click'); }
  async restore(): Promise<void> { await this.window.trigger('pageshow'); }
}
