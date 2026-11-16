export default {
  paths: ['features/decision_inbox.feature', 'features/outline_runs.feature', 'features/supporting_features.feature', 'features/requirement_nesting.feature', 'features/step_evidence.feature', 'features/startup.feature', 'features/intent_workflow.feature', 'features/test_lineage.feature', 'features/lineage_report_presentation.feature', 'features/mobile_review.feature', 'features/requirements_first.feature', 'features/local_consumer_workflow.feature'],
  import: ['features/hooks.ts', 'features/steps/**/*.ts'],
  format: ['progress'],
  parallel: 0,
  strict: true
};
