# Test lineage requirement

The scope of [test_lineage.feature](../../features/test_lineage.feature) was
agreed in chat on 30 October 2026. The scenario now runs in the acceptance suite,
with the implementation and protection changes pending source review.

The Gherkin scenario and its associated BDD-style unit tests share the lineage
ID `test-lineage`. A successful test run generates an HTML interface listing
the related unit tests' descriptions under the scenario. Jasmine-style
`describe` and `it` specifications are the model for those descriptions.

The implementation uses a custom Node test reporter. Tests use the existing
Node BDD API with native tags: `it('description', { tags: ['test-lineage'] }, fn)`.
This requires Node.js 24.19+. Native test tags currently emit an experimental
feature warning. The report displays enclosing `describe` names followed by
the `it` description, using the tests that actually ran.

Run `npm run test:lineage` to generate `test-lineage.html`. Open that file in a
browser; it is standalone HTML and needs no server. Feature roots come from
`.intentdd.json`, defaulting to `features` in projects without configuration.

Select a scenario name to expand its associated unit-test descriptions; select
it again to collapse them. The native disclosure control also works with the
keyboard. A scenario with no matching tests explains that none ran with a
matching lineage ID.

## Future features

- Expand a test description to show its logic.

## Presentation and individual acceptance

[lineage_report_presentation.feature](../../features/lineage_report_presentation.feature)
defines disclosure icons, pass/fail colours and specification-change colours.
Passing tests are green, failing tests red, and specifications without executed
related tests are neutral. The runner still returns a failing exit status when
tests fail, while producing the HTML report.

Specification changes are compared with the last individually accepted report
definition in `intentdd.lock.json`, rather than the last unaccepted run. Added, Modified and Removed
markers use separate colours and labels from execution results. On first use,
specifications are Added until accepted. Source-line shifts do not count as
changes; inherited Feature, Rule and Background meaning does.

Scenarios are grouped first by Failed, Passed and Not run, then by Added,
Changed, Unchanged and Removed. Empty groups are omitted, and each group shows
its specification count. Individual acceptance moves the scenario into its
Unchanged group immediately, preserving its expanded state and updating counts.

Run `npm start` and open the printed URL followed by `/lineage`. Expand a
specification, inspect the previously accepted and current Gherkin under
**Review specification change**, then choose **Accept this specification
change**. Other specification baselines remain unchanged. Stale reports,
changed source and stale individual acceptances are rejected.

Accepted definitions and fingerprints live in the portable `intentdd.lock.json`.
The latest generated report stays in `.intentdd/lineage/latest.json`.
Regenerating a report never accepts changes. Existing local acceptance state is
read until individual human acceptance creates the lock; the lock then takes
precedence. Standalone HTML remains readable. Mobile review exports additionally support
copying explicit approval records for deterministic import. Scenario renames appear as a removal and addition; duplicate
names are matched in declaration order.

## Accepted specification workflow

[intent_workflow.feature](../../features/intent_workflow.feature) defines the
ordinary-project-folder interface and acceptance lock. The report is the home
page. `verify` checks current source against the latest report, failing results,
and pending specification acceptance against the lock. `spec` renders current
Gherkin source. No explicit classification or source-control integration is
part of this workflow.

## Unified specification and test report

The Intent DD home page incorporates the test report. Expand a scenario to read
its Gherkin followed by the supporting BDD unit-test descriptions. Each test row
shows its matching lineage ID; unrelated test tags do not appear as connections.
Accepted specifications retain their Gherkin source in this view. The generated
standalone report presents the same information.

For example, `@test-lineage` on a scenario links to
`it('description', { tags: ['test-lineage'] }, fn)` in the unit tests.

## Offline mobile review

[mobile_review.feature](../../features/mobile_review.feature) defines static review
generation, selective pasted approval and rejection after unselected source changes.
`review --output PREFIX` exports HTML plus a plain-text companion without accepting
anything. Review records bind the complete report and accepted baseline, and identify
each exact proposed definition or removal. HTML selection starts empty; copying text
prepares a response only. The companion supports copying individual complete envelopes
when scripts are unavailable.

`approve` reads exact user-authorised envelopes from stdin or `--file PATH`. All
selected records are validated before one atomic lock update. Empty, duplicate,
malformed, altered, unknown and stale decisions fail without partial acceptance.
Unselected definitions and test outcomes remain unchanged. The protocol provides
content integrity and freshness, not independent human authentication. Agent-generated
approvals and approvals inferred from files or examples are forbidden. Specification
acceptance does not authorise commits or approve implementation changes.
