import { assert } from '../support/evidence.js';
import { Given, When, Then, After } from '@cucumber/cucumber';
import { OutlineRunsDriver } from '../support/outline-runs-driver.js';
interface OutlineWorld { outlines?: OutlineRunsDriver }
Given('a report contains a passing and a failing outline example with nested specifications', function (this: OutlineWorld) {
  this.outlines = new OutlineRunsDriver(); this.outlines.fixtures(); this.outlines.collect();
});
When('I open the executed outline', async function (this: OutlineWorld) { await this.outlines!.open(); });
Then('each execution has a numbered tab below the outline description', async function (this: OutlineWorld) { await this.outlines!.tabs(); });
Then("the selected tab shows only that run's substituted steps and logs", async function (this: OutlineWorld) { await this.outlines!.panel('one'); });
When('I select the failing example tab', async function (this: OutlineWorld) { await this.outlines!.failing(); });
Then("its failed result and logs are shown without the passing run's logs", async function (this: OutlineWorld) { await this.outlines!.panel('two'); });
Then('substituted table cells and doc strings are shown as escaped text', async function (this: OutlineWorld) { await this.outlines!.arguments(); });
Then('every example tab links to the nested specification at its owning step', async function (this: OutlineWorld) { await this.outlines!.links(); });
Then('returning from a nested specification retains the selected example', async function (this: OutlineWorld) { const selected = await this.outlines!.page!.getByRole('tab').nth(1).getAttribute('aria-selected'); assert.equal(selected, 'true'); });
Then('arrow keys and Home and End select execution tabs', async function (this: OutlineWorld) { await this.outlines!.keyboard(); });
After(async function (this: OutlineWorld) { await this.outlines?.shutdown(); });

Given('a report contains an outline example that was retried', function (this: OutlineWorld) {
  this.outlines = new OutlineRunsDriver(); this.outlines.fixtures(); this.outlines.collect(1);
});
Then('each attempt has its own tab and evidence', async function (this: OutlineWorld) { await this.outlines!.retries(); });
