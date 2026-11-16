Feature: Review implementation choices in a separate decision inbox
  Specification acceptance and implementation flexibility are separate decisions.
  Unclassified choices remain visible without blocking specification review.
  Mutation results are evidence, not permission to change accepted requirements.

  @decision-inbox-review
  Scenario: Review and classify a proposed implementation choice
    Given a project with a proposed material-ordering decision
    When I open the separate decision inbox
    Then the decision is grouped by journey and component with its evidence
    When I classify the decision as flexible with a scope and rationale
    Then the decision persists independently of specification acceptance
    And other unresolved decisions remain visible

  @decision-inbox-stale
  Scenario: Reject a decision made against an outdated inbox
    Given a project with a proposed material-ordering decision
    When the proposal changes after I open the decision inbox
    Then my outdated classification is rejected without changing decisions

  @decision-inbox-mutations
  Scenario: Import mutation evidence without automatically classifying survivors
    Given a project with a mutation report containing a survivor and a killed mutant
    When I import the mutation report into the decision inbox
    Then only the survivor needs a human decision and retains its mutation evidence
    And importing the same evidence preserves decisions but changed evidence reopens review

  @decision-inbox-validation
  Scenario: Reject an invalid proposal batch without losing existing decisions
    Given a project with a proposed material-ordering decision
    When I import a batch containing duplicate decision identifiers
    Then the entire batch is rejected and the existing inbox is preserved
