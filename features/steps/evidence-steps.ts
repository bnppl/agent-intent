import { After, Given, Then, When } from '@cucumber/cucumber';
import { EvidenceDriver } from '../support/evidence-driver.js';

interface EvidenceWorld { evidence?: EvidenceDriver }
Given('a Cucumber outline with a logged background and repeated step text', function (this: EvidenceWorld) {
  this.evidence = new EvidenceDriver();
  this.evidence.fixtures();
});
When('the outline runs and generates a lineage report', function (this: EvidenceWorld) {
  this.evidence!.collect();
});
Then('each example has its own tab with substituted Gherkin and step logs', function (this: EvidenceWorld) {
  this.evidence!.assertPlacement();
});
Then('steps without logs remain visible as plain Gherkin rows', function (this: EvidenceWorld) {
  this.evidence!.assertUnloggedStep();
});
Then('the failed step keeps its logs and displays captured markup as text', function (this: EvidenceWorld) {
  this.evidence!.assertFailure();
});
After(function (this: EvidenceWorld) { this.evidence?.close(); });

Given('a Cucumber step throws an error without attaching a log', function (this: EvidenceWorld) {
  this.evidence = new EvidenceDriver();
  this.evidence.errorFixture();
});
When('its execution is imported into the report', function (this: EvidenceWorld) { this.evidence!.collect(); });
Then('the failed step includes the error message and stack trace as escaped evidence', function (this: EvidenceWorld) { this.evidence!.assertError(); });
Then("passing steps do not receive the failed step's error", function (this: EvidenceWorld) { this.evidence!.assertErrorAttribution(); });
