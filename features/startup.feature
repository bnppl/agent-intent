Feature: Start the review workbench with one command
  New startup requirements are proposals pending human acceptance.

  @startup-check-order
  Scenario: Run configured project checks in order
    When the startup checks succeed
    Then startup runs build, test, and test:lineage in order

  @startup-check-failure
  Scenario: Stop startup when a check fails
    When the startup test check fails
    Then startup fails without running lineage generation

  @startup-consumer-run
  Scenario: Require fresh evidence from the consuming project
    When a consuming project runs configured checks through the packaged CLI
    Then missing commands, failed checks, and stale reports are rejected

  @startup-consumer-server
  Scenario: Manage a background server for only the consuming project
    When a consuming project starts and refreshes its packaged workbench
    Then its page stays available after startup exits and another project cannot stop it
