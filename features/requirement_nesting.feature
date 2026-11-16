Feature: Specifications nested under project requirements
  Stable requirement IDs connect the project brief to executable specifications.
  Feature tags supply a default; the last requirement tag on a scenario overrides it.

  @requirement-nesting
  Scenario: Browse specifications under their requirements
    Given a brief with identified requirements and inherited specification links
    When I render its specification report
    Then each linked specification appears inside its requirement
    And requirements without specifications and unlinked specifications remain visible

  @requirement-nesting-boundaries
  Scenario: Preserve links when requirement wording changes
    Given a brief with renamed requirements and an unknown specification link
    When I render its specification report
    Then stable links survive and unknown links remain visible

  @report-stack-navigation
  Scenario: Traverse from intent to a specification and back
    Given a brief with identified requirements and inherited specification links
    When I render its specification report
    Then the overview contains only the problem statement and requirement entries
    And requirements and specifications provide controls to drill down and back up

  @report-stack-wayfinding
  Scenario: Keep orientation while navigating the report
    Given a brief with identified requirements and inherited specification links
    When I render its specification report
    Then the report provides persistent Back and breadcrumb navigation

  @report-global-run-status
  Scenario: Keep a failed run warning outside individual requirements
    Given a brief with identified requirements and inherited specification links
    And the overall test run failed
    When I render its specification report
    Then one overall run warning appears outside the requirement drill-down
    And no requirement is labelled with the overall run failure
