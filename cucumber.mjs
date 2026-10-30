export default {
  paths: ['features/intent_workflow.feature', 'features/test_lineage.feature', 'features/lineage_report_presentation.feature', 'features/mobile_review.feature'],
  import: ['features/hooks.ts', 'features/steps/**/*.ts'],
  format: ['progress'],
  parallel: 0,
  strict: true
};
