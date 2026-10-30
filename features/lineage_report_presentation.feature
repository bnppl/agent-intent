Feature: Understand test lineage results and specification changes
  A developer can recognise expandable specifications, test results, and changes
  since the last report whose specification changes they accepted in the web interface.

  @report-brand-logo
  Scenario: Display the embedded Agent Intent logo
    Given a specification with associated unit-test descriptions
    When I view the generated report
    Then the report includes the embedded Agent Intent logo
    And the local image policy permits the embedded logo without permitting external images

  @report-workbench-tabs
  Scenario: Navigate specifications, changes and workflow guidance
    Given a previously generated report whose specification changes were accepted in the web interface
    And a specification has changed since that accepted report
    When a new report is generated
    Then the report links to specifications, pending changes and workflow guidance
    And the changes view contains only specifications awaiting acceptance
    And the workflow view explains reporting, individual acceptance, verification and mobile review

  @report-expansion
  Scenario: Recognise a specification with nested unit tests
    Given a specification with associated unit-test descriptions
    When I view the generated report
    Then the specification has an icon indicating that it can be expanded
    And its associated unit-test descriptions are inside the expandable section
    And the icon distinguishes collapsed and expanded states

  @report-results
  Scenario: Distinguish passing and failing results
    Given a specification with a passing associated unit test
    And a specification with a failing associated unit test
    When the tests run with HTML reporting enabled
    Then the report is generated despite the test failure
    And the passing result is coloured green and labelled "Passed"
    And the failing result is coloured red and labelled "Failed"
    And a specification with a failing associated unit test is labelled "Failed"

  @report-change-markers
  Scenario: Distinguish specification changes from test results
    Given a previously generated report whose specification changes were accepted in the web interface
    And a specification has changed since that accepted report
    When a new report is generated
    Then the changed specification has a coloured "Modified" marker
    And its test-result colour and label remain visible separately
    And unchanged specifications have no "Modified" marker

  @report-baseline
  Scenario: Preserve the accepted comparison baseline
    Given a previously generated report whose specification changes were accepted in the web interface
    And a specification has changed since that accepted report
    When a new report is generated without accepting those changes
    And another report is generated
    Then both reports identify the specification as modified since the accepted report

  @report-individual-acceptance
  Scenario: Accept specification changes individually
    Given a previously generated report whose specification changes were accepted in the web interface
    And two specifications have changed since that accepted report
    When I accept the first specification change in the web interface
    Then that specification is no longer marked as modified
    And the second specification remains marked as modified

  @report-additions-removals
  Scenario: Identify added and removed specifications
    Given a previously generated report whose specification changes were accepted in the web interface
    And a specification has been added and another has been removed
    When a new report is generated
    Then the new specification has a coloured "Added" marker
    And the removed specification has a coloured "Removed" marker

  @report-grouping
  Scenario: Group specifications by run status and change status
    Given a report with passing, failing and unexecuted specifications
    When the tests run with HTML reporting enabled
    Then failed specifications are grouped before passed and unexecuted specifications
    And each run-status group separates added, changed and unchanged specifications
    And each group shows its number of specifications

  @integrated-lineage
  Scenario: Read Gherkin and its supporting tests in the Agent Intent report
    Given a previously generated report whose specification changes were accepted in the web interface
    When a new report is generated
    Then the Agent Intent report shows the accepted Gherkin alongside its supporting tests
    And the report identifies shared lineage above the supporting tests

  @test-code
  Scenario: Expand the actual code of a supporting unit test
    Given a specification with associated unit-test descriptions
    When I view the generated report
    Then each supporting unit test has a collapsed test-code control
    And the test-code control is an inline icon labelled for accessibility
    And expanding the control reveals the actual test declaration and assertions


  @compact-test-rows
  Scenario: Show only additional tags beneath supporting tests
    Given a specification with associated unit-test descriptions
    And its supporting test also has tags "fast" and "smoke"
    When I view the generated report
    Then the test displays its additional tags without repeating the scenario lineage


  @source-highlighting
  Scenario: Read syntax-highlighted test code
    Given a specification with associated unit-test descriptions
    When I view the generated report
    Then the collapsed test-code view contains syntax highlighting without loading external scripts

  @editor-links
  Scenario: Open scenario and test source in the configured IDE
    Given a specification with associated unit-test descriptions
    When I view the generated report
    Then the scenario and test source locations link to their lines in VS Code by default

  @gherkin-highlighting
  Scenario: Read highlighted Gherkin and specification changes
    Given a previously generated report whose specification changes were accepted in the web interface
    And a specification has changed since that accepted report
    When a new report is generated
    Then the Gherkin source and both change previews are syntax-highlighted

  @report-unexecuted
  Scenario: Show unexecuted specifications without claiming success
    Given a specification with no associated executed tests
    When I view the generated report
    Then that specification is labelled "Not run"

  @editor-custom-template
  Scenario: Use a configured IDE template with escaped source paths
    Given a specification with associated unit-test descriptions
    And a configured IDE template and a test path containing spaces and a hash
    When I view the generated report
    Then local and standalone source links use the configured template and escaped path

  @editor-template-validation
  Scenario Outline: Reject invalid IDE configuration
    Given a specification with associated unit-test descriptions
    And the IDE template is <template>
    When I request the report with that configuration
    Then the report rejects the invalid IDE template
    Examples:
      | template                   |
      | javascript:alert(1)         |
      | data:text/html,{path}       |
      | vscode://file/{unknown}     |
      | a non-string value         |

  @inline-acceptance
  Scenario: Accept a specification from its collapsed report row
    Given a specification with associated unit-test descriptions
    When I view the generated report
    Then the collapsed scenario row contains its acceptance button

  @stop-service
  Scenario: Target only this project's report service when stopping
    Given a stop request for this project
    Then only an Agent Intent serve process in this project is eligible to stop
