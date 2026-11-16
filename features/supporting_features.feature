Feature: Inspect the components that enable a scenario step
  Components retain their independent test evidence and acceptance.

  @supporting-feature-navigation
  Scenario: Drill from an unexecuted end-to-end step into components
    Given an end-to-end scenario has a stable lineage tag and numbered Gherkin steps
    And API and frontend scenarios support its first step using supports tags
    When the reviewer opens that step's components
    Then a separate view lists the API and frontend features and their independent results
    And each supporting scenario retains its test source and step logs
    And the reviewer can return to the originating step
    And passing subsystem tests do not make the unexecuted end-to-end scenario pass

  @supporting-feature-diagnostics
  Scenario: Explain invalid supporting-feature relationships
    Given supports tags reference missing or ambiguous scenarios, invalid steps, or cycles
    When the report is rendered
    Then visible diagnostics explain each invalid relationship
    And invalid supporting scenarios remain available in the root report

  @component-depth-navigation
  Scenario: Keep drilling through each component level
    Given an end-to-end scenario has a stable lineage tag and numbered Gherkin steps
    And API and frontend scenarios support its first step using supports tags
    When the reviewer opens that step's components
    Then component features offer their own report level
    And component scenarios and their step evidence offer further report levels
    And each level keeps breadcrumbs and one-level Back navigation

  @component-grouping
  Scenario: Group component features by their named component
    Given an end-to-end scenario has a stable lineage tag and numbered Gherkin steps
    And supporting features name their Game API and Web App components
    When the reviewer opens that step's components
    Then the report groups the features under Game API and Web App
    And each supporting scenario retains its test source and step logs
