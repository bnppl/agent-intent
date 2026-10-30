Feature: Review specifications against an accepted lock
  Every Gherkin scenario is a specification. Acceptance belongs to each
  specification and persists separately from test execution results.

  @specification-lock
  Scenario: Review a report in an ordinary project folder
    Given a project with specifications and related passing tests
    When its tests generate a report
    Then the project home page shows the specification report

  @specification-lock
  Scenario: Accept one specification into the lock file
    Given a project with specifications and related passing tests
    When its tests generate a report
    And I accept one specification
    Then the lock contains only that accepted specification
    And another test run leaves the lock unchanged

  @specification-lock
  Scenario: Verify against accepted specifications
    Given a project with specifications and related passing tests
    When its tests generate a report
    Then verification reports pending specification acceptance
    When I accept every specification
    Then verification succeeds against the lock
