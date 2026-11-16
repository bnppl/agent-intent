Feature: Review a project's intent before writing application code
  A project starts with a problem statement describing the broad intent and
  one or more high-level requirements. Each requirement is a single sentence
  describing one piece of functionality or one user journey.

  @starter-intent-template
  Scenario: Start with a project brief template
    Given a project folder without a project brief
    When I initialise its Agent Intent brief
    Then the template tells me how to replace its instructions with my own problem statement and requirements
    And the untouched template is shown as an incomplete brief

  @starter-intent-preserve
  Scenario: Preserve an existing project brief
    Given a project folder with a completed brief
    When I initialise its Agent Intent brief again
    Then Agent Intent reports that the brief already exists
    And the completed brief is preserved

  @starter-intent-preview
  Scenario: Read the project brief in the interactive report before implementation
    Given a project with no application code, Gherkin scenarios, or test results
    And its problem statement is "People need a reliable way to repeat a trebuchet launch setup."
    And its high-level requirement is "A player can save a launch setup for reuse."
    When I open its interactive Agent Intent report
    Then I see the problem statement above the list of high-level requirements
    And the report indicates that no tests have run

  @starter-intent-incomplete
  Scenario Outline: Identify a missing part of the brief
    Given a project brief missing <part>
    When I open its interactive Agent Intent report
    Then the report identifies <part> as required to complete the brief

    Examples:
      | part                               |
      | the problem statement              |
      | at least one high-level requirement |
