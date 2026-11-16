import { Given, When, Then } from '@cucumber/cucumber';
import { RequirementDriver } from '../support/requirement-driver.js';
let driver: RequirementDriver;
Given('a brief with identified requirements and inherited specification links', () => { driver = new RequirementDriver(); });
Given('a brief with renamed requirements and an unknown specification link', () => { driver = new RequirementDriver(); driver.renamed = true; });
When('I render its specification report', () => driver.render());
Then('each linked specification appears inside its requirement', () => driver.linked());
Then('requirements without specifications and unlinked specifications remain visible', () => driver.gaps());
Then('stable links survive and unknown links remain visible', () => driver.stable());
Then('the overview contains only the problem statement and requirement entries', () => driver.overview());
Then('requirements and specifications provide controls to drill down and back up', () => driver.navigation());
Then('the report provides persistent Back and breadcrumb navigation', () => driver.wayfinding());

Given('the overall test run failed', () => { driver.runFailed = true; });
Then('one overall run warning appears outside the requirement drill-down', () => driver.globalRunStatus());
Then('no requirement is labelled with the overall run failure', () => driver.noRequirementRunFailure());
