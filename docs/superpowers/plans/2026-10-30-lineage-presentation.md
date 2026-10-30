# Lineage report presentation and acceptance

Specification: `features/lineage_report_presentation.feature`.

Use the existing green/cream workbench palette, authored SVG disclosure icons,
green/red result labels and separate blue/amber/purple change labels. Keep
native keyboard-accessible disclosure controls. Do not use colour alone.

The Node reporter must include failed results, preserve the runner's nonzero
exit status, and save a structured latest report under `.intentdd/lineage/`.
Store accepted specification definitions separately in that ignored directory.
Only a human action in the local web interface advances an individual baseline;
generating reports never accepts changes. An initial specification is Added.
Compare Gherkin semantic definitions, ignoring AST IDs and source locations,
including inherited feature/rule/background meaning. Renames are removal/addition.

Serve the report at `/lineage` in the existing loopback workbench. Its mutation
token, Host/Origin protections and CSP remain intact. Static HTML remains
viewable; acceptance uses the local server. Reject acceptance when the report,
specification source, or that specification's accepted baseline has changed.
Report acceptance never approves the staged Git revision.

- [x] RED: presentation, failing-run, and individual acceptance regression tests
- [x] GREEN: report status/icon styling and structured report state
- [x] GREEN: per-specification comparison and web acceptance
- [x] Wire the new feature's domain steps into the acceptance suite
- [x] Full suite, generated report, protected-boundary review and UI inspection

## Evidence and review

The first eight regression tests failed on missing icon/status markup,
missing failed-test descriptions and absent report acceptance routes. All
passed after implementation. An additional before/after Gherkin review test
failed before adding specification content to the acceptance screen.

The six new acceptance scenarios passed, including the failed-run case and
individual acceptance that leaves other changes Modified. Regression tests
cover source-line movement, inherited Background changes, stale source,
stale reports, stale acceptance and session-token enforcement.

Independent review found Examples descriptions were absent from the review
preview. A reproducing test failed, then passed after the fix. Browser testing
on a disposable fixture confirmed clicking a scenario expands its tests and
individual acceptance clears only that scenario's change marker. It also
exposed obsolete comparison content remaining after acceptance; the client now
removes that comparison. No real repository report baselines were accepted.

Final validation: `npm run build`, `npm test`, and `npm run test:lineage`
passed. There are 24 passing acceptance scenarios (166 steps) and 54 passing
tests. Native Node test tags retain their experimental-feature warning.
The design detector reported no findings; all six status/change foreground
and background pairs exceed 5.2:1 contrast. Browser inspection confirmed native
expansion, distinct pass/fail/change states, and individual acceptance in an
isolated disposable fixture. A fixture screenshot is saved at
`/private/tmp/intent-dd-lineage-presentation.jpg`. The real workbench report is
served at `http://127.0.0.1:8765/lineage` for human review.

## Grouping follow-up

The developer requested grouping by run status and specification change state.
Two regression tests failed before adding the grouping. The report now orders
Failed, Passed and Not run groups, each split into nonempty Added, Changed,
Unchanged and Removed subgroups with counts. Shared group definitions keep
standalone output and browser updates consistent. Individual acceptance moves
the existing scenario node into Unchanged, retaining its disclosure state,
event handlers and keyboard focus; empty groups are removed and counts refreshed.

Validation: build and full suite passed, with 25 scenarios (174 steps) and 56
tests. Browser testing in a disposable fixture confirmed live regrouping after
individual acceptance while the other status groups remained unchanged. The
design detector reported no findings. Screenshot:
`/private/tmp/intent-dd-lineage-grouped.jpg`.
