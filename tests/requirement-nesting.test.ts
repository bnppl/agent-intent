import { it } from 'node:test';
import { RequirementDriver } from '../features/support/requirement-driver.js';
it('nests specifications using inherited and overriding requirement links and exposes gaps', { tags: ['requirement-nesting'] }, () => {
  const driver = new RequirementDriver(); driver.render(); driver.linked(); driver.gaps();
});
it('keeps renamed requirement links stable and exposes unknown links', { tags: ['requirement-nesting-boundaries'] }, () => {
  const driver = new RequirementDriver(); driver.renamed = true; driver.render(); driver.stable();
});
it('presents an uncluttered overview and reversible disclosure navigation', { tags: ['report-stack-navigation'] }, () => {
  const driver = new RequirementDriver(); driver.render(); driver.overview(); driver.navigation();
});
it('provides a stable navigation frame and accessible breadcrumb controls', { tags: ['report-stack-wayfinding'] }, () => {
  const driver = new RequirementDriver(); driver.render(); driver.wayfinding();
});

it('keeps the overall failed run warning outside all requirement groups', { tags: ['report-global-run-status'] }, () => {
  const driver = new RequirementDriver(); driver.runFailed = true; driver.render(); driver.globalRunStatus(); driver.noRequirementRunFailure();
});
