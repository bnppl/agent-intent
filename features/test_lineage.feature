Feature: Navigate from Gherkin scenarios to related unit tests

  @test-lineage
  Scenario: List unit tests associated with a Gherkin scenario
    Given a Gherkin scenario tagged "test-lineage"
    And BDD-style unit tests with the same lineage tag
    When the tests run successfully with HTML reporting enabled
    Then an HTML interface is generated
    And the scenario can be expanded to show its associated unit-test descriptions
    And the scenario lists the associated unit tests' BDD descriptions
