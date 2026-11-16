Feature: Inspect end-to-end test evidence under each Gherkin step

  @step-evidence
  Scenario: Keep step logs with the outline example that produced them
    Given a Cucumber outline with a logged background and repeated step text
    When the outline runs and generates a lineage report
    Then each example has its own tab with substituted Gherkin and step logs
    And steps without logs remain visible as plain Gherkin rows

  @step-evidence-failure
  Scenario: Review evidence from a failed step
    Given a Cucumber outline with a logged background and repeated step text
    When the outline runs and generates a lineage report
    Then the failed step keeps its logs and displays captured markup as text

  @step-error-message
  Scenario: Inspect the error that caused a step failure
    Given a Cucumber step throws an error without attaching a log
    When its execution is imported into the report
    Then the failed step includes the error message and stack trace as escaped evidence
    And passing steps do not receive the failed step's error
