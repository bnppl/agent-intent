Feature: Review specifications against an accepted lock
  Every Gherkin scenario is a specification. Acceptance belongs to each
  specification and persists separately from test execution results.

  @report-home
  Scenario: Review a report in an ordinary project folder
    Given a project with specifications and related passing tests
    When its tests generate a report
    Then the project home page shows the specification report

  @lock-individual-acceptance
  Scenario: Accept one specification into the lock file
    Given a project with specifications and related passing tests
    When its tests generate a report
    And I accept one specification
    Then the lock contains only that accepted specification
    And another test run leaves the lock unchanged

  @lock-verification
  Scenario: Verify against accepted specifications
    Given a project with specifications and related passing tests
    When its tests generate a report
    Then verification reports pending specification acceptance
    When I accept every specification
    Then verification succeeds against the lock

  @specification-discovery-safety
  Scenario Outline: Reject unsafe or invalid specification inputs
    Given a project with specifications and related passing tests
    When specification discovery encounters "<input>"
    Then specification discovery fails with an explanation
    Examples:
      | input                  |
      | a root outside project |
      | a symlinked feature    |
      | symlinked configuration|
      | malformed Gherkin      |

  @specification-semantics
  Scenario: Preserve inherited and outline meaning independently of line numbers
    Given a specification with inherited tags, a background, a docstring and examples
    When its specification definition is read
    Then inherited tags, docstrings and example values are preserved
    And moving its source lines leaves its fingerprint unchanged
    And changing its background or example value changes its fingerprint
    And example descriptions remain visible in its readable definition

  @specification-source
  Scenario: Read current Gherkin without running supporting tests
    Given a project with specifications and related passing tests
    When I request the current specification source
    Then both current Gherkin scenarios are printed without creating a report

  @verification-freshness
  Scenario: Reject verification after specification source changes
    Given a project with specifications and related passing tests
    When its tests generate a report
    And its specification source changes without another run
    Then verification asks for a new test run

  @verification-failures
  Scenario Outline: Keep test failures separate from specification agreement
    Given a project with specifications and related passing tests
    When its tests generate a report
    And I accept every specification
    And a new test run has "<failure>"
    Then verification reports a failed test run
    Examples:
      | failure        |
      | a failing test |
      | failed teardown|

  @lock-baseline-persistence
  Scenario: Preserve accepted specifications when creating a portable lock
    Given a project with specifications and related passing tests
    When its tests generate a report
    And a local acceptance baseline contains the first specification
    Then the accepted specification is readable without creating a portable lock
    When I accept the second specification
    Then the portable lock contains both specifications and is the authoritative acceptance baseline

  @lock-invalid-state
  Scenario: Reject an invalid portable lock while preserving acceptance data
    Given a project with specifications and related passing tests
    When its tests generate a report
    And a local acceptance baseline contains the first specification
    And the portable lock is invalid
    Then reading acceptance rejects the invalid lock without replacing it

  @lock-removal
  Scenario: Accept a removed specification without changing the retained entry
    Given a project with specifications and related passing tests
    When its tests generate a report
    And I accept every specification
    And the second specification is removed and tests generate a report
    And I accept the removed specification
    Then the lock retains only the unchanged first specification
    And verification succeeds against the lock

  @acceptance-freshness
  Scenario Outline: Reject unauthorised or stale local acceptance
    Given a project with specifications and related passing tests
    When its tests generate a report
    And a local acceptance request has "<problem>"
    Then that acceptance request is rejected without changing the lock
    Examples:
      | problem           |
      | no session token  |
      | a replaced report |
      | changed source    |
      | changed acceptance|

  @acceptance-http-boundaries
  Scenario Outline: Reject invalid local HTTP requests without accepting specifications
    Given a project with specifications and related passing tests
    When its tests generate a report
    And a local HTTP request has "<problem>"
    Then the HTTP request is rejected without creating a lock
    And report responses restrict scripts to this server and disable caching
    Examples:
      | problem            |
      | a foreign origin   |
      | an unexpected host |
      | cross-site metadata|
      | malformed acceptance|
      | a non-JSON body    |
