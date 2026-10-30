@mobile-static-review
Feature: Review specification changes from a phone without a local server
  A developer reviews static files and pastes only the decisions they authorise.
  Preparing approval text never changes the accepted specification lock.

  Scenario: Export a review without accepting any specifications
    Given a mobile review project with two proposed specifications
    When I export the mobile review files
    Then the static files show the specifications and copyable approval records
    And no specifications have been accepted

  Scenario: Apply only the developer's pasted selection
    Given a mobile review project with two proposed specifications
    When I paste an approval for the first specification
    Then only the first specification is accepted

  Scenario: Reject approval after an unselected specification changes
    Given a mobile review project with two proposed specifications
    And a copied approval for the first specification
    When the second specification changes after review
    Then importing the copied approval fails without accepting any specifications
