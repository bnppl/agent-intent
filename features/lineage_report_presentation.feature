@lineage-report-presentation
Feature: Understand test lineage results and specification changes
  A developer can recognise expandable specifications, test results, and changes
  since the last report whose specification changes they accepted in the web interface.

  Scenario: Recognise a specification with nested unit tests
    Given a specification with associated unit-test descriptions
    When I view the generated report
    Then the specification has an icon indicating that it can be expanded
    And its associated unit-test descriptions are inside the expandable section
    And the icon distinguishes collapsed and expanded states

  Scenario: Distinguish passing and failing results
    Given a specification with a passing associated unit test
    And a specification with a failing associated unit test
    When the tests run with HTML reporting enabled
    Then the report is generated despite the test failure
    And the passing result is coloured green and labelled "Passed"
    And the failing result is coloured red and labelled "Failed"
    And a specification with a failing associated unit test is labelled "Failed"

  Scenario: Distinguish specification changes from test results
    Given a previously generated report whose specification changes were accepted in the web interface
    And a specification has changed since that accepted report
    When a new report is generated
    Then the changed specification has a coloured "Modified" marker
    And its test-result colour and label remain visible separately
    And unchanged specifications have no "Modified" marker

  Scenario: Preserve the accepted comparison baseline
    Given a previously generated report whose specification changes were accepted in the web interface
    And a specification has changed since that accepted report
    When a new report is generated without accepting those changes
    And another report is generated
    Then both reports identify the specification as modified since the accepted report

  Scenario: Accept specification changes individually
    Given a previously generated report whose specification changes were accepted in the web interface
    And two specifications have changed since that accepted report
    When I accept the first specification change in the web interface
    Then that specification is no longer marked as modified
    And the second specification remains marked as modified

  Scenario: Identify added and removed specifications
    Given a previously generated report whose specification changes were accepted in the web interface
    And a specification has been added and another has been removed
    When a new report is generated
    Then the new specification has a coloured "Added" marker
    And the removed specification has a coloured "Removed" marker

  Scenario: Group specifications by run status and change status
    Given a report with passing, failing and unexecuted specifications
    When the tests run with HTML reporting enabled
    Then failed specifications are grouped before passed and unexecuted specifications
    And each run-status group separates added, changed and unchanged specifications
    And each group shows its number of specifications

  @integrated-lineage
  Scenario: Read Gherkin and its supporting tests in the Intent DD report
    Given a previously generated report whose specification changes were accepted in the web interface
    When a new report is generated
    Then the Intent DD report shows the accepted Gherkin alongside its supporting tests
    And each supporting test displays the lineage ID connecting it to the scenario
