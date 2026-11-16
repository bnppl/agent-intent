import { Given, Then, When } from '@cucumber/cucumber';
import { SupportingFeatureDriver } from '../support/supporting-feature-driver.js';
interface SupportWorld { supporting?: SupportingFeatureDriver }
Given('an end-to-end scenario has a stable lineage tag and numbered Gherkin steps', function (this: SupportWorld) { this.supporting = new SupportingFeatureDriver(); this.supporting.parent(); });
Given('API and frontend scenarios support its first step using supports tags', function (this: SupportWorld) { this.supporting!.children(); });
When("the reviewer opens that step's components", function (this: SupportWorld) { this.supporting!.render(); });
Then('a separate view lists the API and frontend features and their independent results', function (this: SupportWorld) { this.supporting!.view(); });
Then('each supporting scenario retains its test source and step logs', function (this: SupportWorld) { this.supporting!.evidence(); });
Then('the reviewer can return to the originating step', function (this: SupportWorld) { this.supporting!.back(); });
Then('passing subsystem tests do not make the unexecuted end-to-end scenario pass', function (this: SupportWorld) { this.supporting!.independent(); });
Given('supports tags reference missing or ambiguous scenarios, invalid steps, or cycles', function (this: SupportWorld) { this.supporting = new SupportingFeatureDriver(); this.supporting.invalid(); });
When('the report is rendered', function (this: SupportWorld) { this.supporting!.render(); });
Then('visible diagnostics explain each invalid relationship', function (this: SupportWorld) { this.supporting!.diagnostics(); });
Then('invalid supporting scenarios remain available in the root report', function (this: SupportWorld) { this.supporting!.visible(); });

Then('component features offer their own report level', function (this: SupportWorld) { this.supporting!.featureLevel(); });
Then('component scenarios and their step evidence offer further report levels', function (this: SupportWorld) { this.supporting!.deeperLevels(); });
Then('each level keeps breadcrumbs and one-level Back navigation', function (this: SupportWorld) { this.supporting!.navigation(); });

Given('supporting features name their Game API and Web App components', function (this: SupportWorld) { this.supporting!.namedComponents(); });
Then('the report groups the features under Game API and Web App', function (this: SupportWorld) { this.supporting!.componentGroups(); });
