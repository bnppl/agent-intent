Feature: Review specification changes from a phone without a local server
  A developer reviews static files and pastes only the decisions they authorise.
  Preparing approval text never changes the accepted specification lock.

  @mobile-export
  Scenario: Export a review without accepting any specifications
    Given a mobile review project with two proposed specifications
    When I export the mobile review files
    Then the static files show the specifications and copyable approval records
    And no specifications have been accepted

  @mobile-selection
  Scenario: Apply only the developer's pasted selection
    Given a mobile review project with two proposed specifications
    When I paste an approval for the first specification
    Then only the first specification is accepted

  @mobile-stale-source
  Scenario: Reject approval after an unselected specification changes
    Given a mobile review project with two proposed specifications
    And a copied approval for the first specification
    When the second specification changes after review
    Then importing the copied approval fails without accepting any specifications

  @mobile-invalid-approval
  Scenario Outline: Reject an invalid approval batch atomically
    Given a mobile review project with two proposed specifications
    When a pasted approval batch is "<problem>"
    Then importing that batch fails without changing acceptance
    Examples:
      | problem       |
      | empty         |
      | duplicate     |
      | unknown       |
      | tampered      |
      | malformed     |
      | extra-field   |
      | wrong-version |
      | mixed-review  |

  @mobile-stale-review
  Scenario Outline: Reject approvals from an outdated review
    Given a mobile review project with two proposed specifications
    And a copied approval for the first specification
    When the mobile review becomes stale through "<change>"
    Then importing that batch fails without changing acceptance
    Examples:
      | change   |
      | source   |
      | report   |
      | baseline |
      | replay   |

  @mobile-removal
  Scenario: Batch individual approvals and explicitly approve a removal
    Given a mobile review project with two proposed specifications
    When I import separate approval blocks for both specifications
    And the second mobile specification is removed and reported
    And I import its removal approval
    Then only the first specification is accepted

  @mobile-failed-run
  Scenario: Specification agreement does not clear a failed test outcome
    Given a mobile review project with two proposed specifications
    When the reported test run has failed
    And I import separate approval blocks for both specifications
    Then the test run remains failed and verification fails

  @mobile-paste-format
  Scenario: Preserve delimiter-like names in CRLF approval text
    Given a mobile review project with two proposed specifications
    When I approve a delimiter-like scenario name using CRLF text
    Then that exact scenario is accepted

  @mobile-inert-content
  Scenario Outline: Preserve unusual specification names as inert review content
    Given a mobile review project with two proposed specifications
    When I export a review with a "<kind>" specification name
    Then embedded review records preserve the original name as inert text
    Examples:
      | kind               |
      | script-like        |
      | dollar-replacement |

  @mobile-copy-selection
  Scenario: Prepare only selected approvals and clear restored selections
    Given a mobile review project with two proposed specifications
    When I select the first change in the exported review and copy approvals
    Then the copied text contains only the first approval and acceptance is unchanged
    When I clear the exported selection
    Then the approval text is empty and copying is disabled
    When a page is restored after selecting a change
    Then the approval text is empty and copying is disabled

  @mobile-copy-fallback
  Scenario Outline: Offer manual copying when clipboard access is unavailable
    Given a mobile review project with two proposed specifications
    When I copy a selected exported approval with clipboard access "<access>"
    Then the exact selected approval text is selected for manual copying
    And no specifications have been accepted
    Examples:
      | access  |
      | missing |
      | denied  |
