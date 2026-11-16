Feature: Review scenario outline executions individually
  Reviewers inspect one executed example and attempt at a time, using its
  concrete values and its own evidence while retaining nested specification links.

  @outline-run-tabs
  Scenario: Switch between executed examples
    Given a report contains a passing and a failing outline example with nested specifications
    When I open the executed outline
    Then each execution has a numbered tab below the outline description
    And the selected tab shows only that run's substituted steps and logs
    When I select the failing example tab
    Then its failed result and logs are shown without the passing run's logs
    And substituted table cells and doc strings are shown as escaped text

  @outline-run-links
  Scenario: Follow nested specifications from every example
    Given a report contains a passing and a failing outline example with nested specifications
    When I open the executed outline
    Then every example tab links to the nested specification at its owning step
    And returning from a nested specification retains the selected example

  @outline-run-keyboard
  Scenario: Navigate execution tabs using a keyboard
    Given a report contains a passing and a failing outline example with nested specifications
    When I open the executed outline
    Then arrow keys and Home and End select execution tabs

  @outline-run-retries
  Scenario: Keep retries distinct from their earlier attempts
    Given a report contains an outline example that was retried
    When I open the executed outline
    Then each attempt has its own tab and evidence
