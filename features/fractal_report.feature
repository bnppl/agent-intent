Feature: Browse specifications at their own abstraction level
  Specifications use BDD scenarios or describe/it unit tests. Executable parents
  show failures from the lower level specifications they use.

  @fractal-report
  Scenario: Expand a hierarchy and focus a nested specification
    Given a report with a requirement, an executable journey and nested component scenarios
    When the reviewer expands the hierarchy using the left chevrons
    Then each step contains its own evidence and component sub specifications
    And unit test sub specifications expand to their BDD code and recorded logs
    When the reviewer follows a nested specification title
    Then that specification is the root of a focused report page
    And Back restores the previous hierarchy and its expansion state

  @fractal-report-source
  Scenario: Follow evidence to the executed glue code
    Given an executed step with a recorded glue source location
    When the reviewer expands that step
    Then its evidence includes a VS Code link to the recorded source line

  @fractal-report-layout
  Scenario: Keep report navigation separate from content while scrolling
    Given a focused report with expanded step evidence
    When the reviewer scrolls at desktop or mobile viewport widths
    Then the outline and report content occupy separate layout regions
    And the report does not overflow the viewport horizontally

  @abstraction-deep-links
  Scenario: Open a copied link to an abstraction level
    Given a report with requirements, scenarios, components, steps and unit specifications
    When the reviewer opens a direct link to any of those levels
    Then the linked level is the root of the focused report
    And reloading preserves the selected level and its breadcrumbs

  @inline-spec-acceptance
  Scenario: Review acceptance alongside the specification headline
    Given a report with a specification awaiting acceptance
    When the reviewer expands its requirement
    Then the acceptance button is inline with the scenario headline

  @failure-propagation
  Scenario: Follow a failed supporting test from the project overview
    Given a failed unit test beneath nested supporting component specifications
    When the reviewer views the project overview
    Then its requirement and every owning scenario, component and step show Failed in red
    And the reviewer can drill down through those levels to the failed test and its evidence
    And unrelated requirements retain their own results
