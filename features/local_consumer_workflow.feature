Feature: Try a local Agent Intent change in a consuming project
  A consuming project can exercise a sibling Agent Intent checkout.

  @try-local-agent-intent
  Scenario: Try a command with the current local build
    Given a consuming project links to the sibling Agent Intent checkout
    When I run an Agent Intent command through the local development workflow
    Then the workflow builds the sibling checkout before running the command from the consuming project

  @stop-on-agent-intent-build-failure
  Scenario: Stop when the sibling checkout fails to build
    Given the sibling Agent Intent build fails
    When I run an Agent Intent command through the local development workflow
    Then the workflow reports the build failure without running the linked command

  @stop-agent-intent-report
  Scenario: Stop the sibling project's Agent Intent report
    Given the sibling Agent Intent project is serving its report on the intent port
    When I run the report shutdown command from the consuming project
    Then the sibling project's Agent Intent server stops

  @start-toybox-report
  Scenario: Start a consuming project's report with fresh workflow evidence
    When a consuming project starts and refreshes its workbench through the installed CLI link
    Then its page stays available after startup exits and another project cannot stop it
