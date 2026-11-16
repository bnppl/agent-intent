Feature: Drill into glue-code logs from a specification step
  A reviewer can inspect the actions, results and checks recorded by the glue
  code for each executed Gherkin step through the interactive report.

  @step-evidence-drilldown
  Scenario: Expand a step after navigating from a requirement
    Given a consuming project's report contains an executed specification linked to a requirement
    And its step glue recorded actions, results and assertion values for each step
    When I open the requirement and then its specification in the interactive report
    Then all Gherkin steps have their logs collapsed
    When I expand a Gherkin step
    Then I see the glue-code logs recorded for that step
    And logs from other steps remain under their own steps
    When I return to the specification
    Then the expanded step has its logs collapsed again
    And I can return through the requirement

  @step-evidence-missing
  Scenario: Explain when a test result has no recorded step evidence
    Given a consuming project's report contains a passing test linked to a specification
    And the run did not capture any Gherkin step evidence
    When I open the specification in the interactive report
    Then the report explains that step evidence was not recorded for that run
    And the Gherkin and supporting test result remain available for review
