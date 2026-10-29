@intent
Feature: Human ownership of executable intent
  A developer can mark behaviour directly in a local view.
  A coding agent can implement the behaviour but cannot silently redefine it.

  Scenario: Annotate a scenario without an agent
    Given a repository with an unmarked Gherkin scenario
    When the developer marks the scenario as intent through the local API
    Then the feature file contains the intent annotation
    And no commit is created by the annotation

  Scenario: Detect an edited intent specification
    Given a repository with an accepted intent scenario
    When the specification is changed and staged
    Then verification requires human approval

  Scenario: Protect the glue behind intent
    Given a repository with an accepted intent scenario
    When its glue code is changed and staged
    Then verification requires human approval

  Scenario: Protect shared support code
    Given a repository with an accepted intent scenario
    When its support code is changed and staged
    Then verification requires human approval

  Scenario: Prevent removal of protection
    Given a repository with an accepted intent scenario
    When the intent tag is removed and staged
    Then verification requires human approval

  Scenario: Prevent deletion of an intent specification
    Given a repository with an accepted intent scenario
    When the feature file is deleted and staged
    Then verification requires human approval

  Scenario: Detect a new glue definition that could override a step
    Given a repository with an accepted intent scenario
    When another glue file is added and staged
    Then verification requires human approval

  Scenario: Allow implementation to evolve
    Given a repository with an accepted intent scenario
    When only the system under test is changed and staged
    Then verification allows the commit

  Scenario: Inspect the index rather than unstaged changes
    Given a repository with an accepted intent scenario
    When its glue code is changed but not staged
    Then verification allows the commit

  Scenario: Approve an exact staged revision
    Given a repository with a staged intent change
    When a human approves the displayed staged revision
    Then verification allows the commit

  Scenario: Invalidate approval when the index changes
    Given a repository with a staged intent change
    When a human approves the displayed staged revision
    And another change is staged
    Then verification requires human approval

  Scenario: Prevent approval of an outdated review screen
    Given a repository with a staged intent change
    When the staged revision changes after the review is opened
    Then approval of the old review is refused

  Scenario: Protect verification policy itself
    Given a repository with an accepted intent scenario
    When the glue protection configuration is weakened and staged
    Then verification requires human approval

  Scenario: Fail closed for malformed Gherkin
    Given a repository with an accepted intent scenario
    When invalid Gherkin is staged
    Then verification fails with a parse error

  Scenario: Fail closed for an unresolved merge
    Given a repository with an accepted intent scenario
    When the index contains an unresolved merge
    Then verification refuses the index

  Scenario: Block a real Git commit that edits glue
    Given a repository with an accepted intent scenario
    And the trusted pre-commit hook is installed
    When its glue code is changed and staged
    Then a real Git commit is refused

  Scenario: Candidate verifier edits cannot disable the installed hook
    Given a repository with an accepted intent scenario
    And the trusted pre-commit hook is installed
    When the candidate verifier is changed to always pass
    Then a real Git commit is refused
