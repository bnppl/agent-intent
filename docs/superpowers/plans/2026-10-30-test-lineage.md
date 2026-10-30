# Test lineage implementation plan

**Goal:** Generate HTML listing the BDD unit-test descriptions associated with
each Gherkin scenario after a successful test run.

**Spec:** `features/test_lineage.feature`, promoted unchanged from the proposal
in `docs/requirements/test-lineage.feature`; scope agreed in chat.

**Architecture:** Use Node's existing `describe`/`it` test runner and a custom
reporter. Tests declare `{ tags: ['test-lineage'] }`; Gherkin declares
`@test-lineage`. The reporter joins completed test events to scenarios and
emits standalone HTML through Node's reporter destination option. Read feature
roots from `.intentdd.json`, defaulting to `features` when absent.

**Tech stack:** TypeScript, Node.js 24.19+ (native test tags), Cucumber, esbuild.

## Constraints

- Preserve the existing intent specification, assertions, glue and controls.
- Keep the new requirement as a review proposal without adding `@intent`.
- Do not implement test-logic expansion, failed-run reporting or test results.
- Keep pre-existing working changes intact; do not commit without human review.

## Red/green steps

- [x] Add the agreed scenario to acceptance discovery without changing its meaning.
- [x] Add a real test-run driver and domain steps. Run the acceptance scenario
  and observe that no lineage HTML report is produced by the existing runner.
- [x] Implement a bundled custom reporter and make that scenario pass.
- [x] Add BDD regression tests, observing each fail before its corresponding
  implementation: unrelated tags, nested suite descriptions, multiple scenarios
  and files, and HTML escaping. Each carries the `test-lineage` tag.
- [x] Add a documented `npm run test:lineage` command generating the project's
  own report. Include the new tests in `npm test` and verify both runtime bundles.
- [x] Run `npm run build`, `npm test`, generate the report, and inspect it.

## Review focus

- Link by exact lineage tag, not scenario/test name or substring.
- Use completed test events, excluding skipped tests and suite containers.
- Keep ancestry scoped to each test file, including concurrent suites.
- Render scenario and test descriptions as text, never executable HTML.
- Use the configured feature roots without altering protection policy.

## Evidence

- Baseline: `npm ci` succeeded; `npm test` passed 17 scenarios and 30 unit tests.
- RED: With the empty reporter interface installed, the BDD fixture tests ran
  successfully; the acceptance assertion failed because the HTML was empty.
  All seven lower-level lineage tests failed on missing report content.
- GREEN: The same acceptance scenario passed all seven steps; all seven
  lineage tests passed after implementing the reporter and renderer.
- First full validation attempt: build and typecheck passed; four existing
  HTTP acceptance scenarios failed on sandbox `listen EPERM`. Rerun with
  loopback access is required, without changing those tests.
- Review found shared-helper declaration paths could collide across workers
  or lose enclosing suites. Two reproductions failed before the fix. Tracking
  the ordered `test:start`/`test:pass` descriptions instead of declaration
  paths made both pass. Nine lineage tests also passed on Node 24.19.0.
- Final validation: `npm run build` and `npm test` passed: 18 scenarios,
  96 steps, 39 unit tests. `npm run test:lineage` passed all 39 tests and
  generated `test-lineage.html` with nine associated BDD descriptions.
- The existing `features/intent_workflow.feature` remains byte-for-byte
  unchanged. Pre-existing glue edits and editor files were left untouched.
- HTML source was inspected. Browser preview was unavailable: Chrome was
  not connected and the in-app browser disallowed local file URLs.
- Review boundaries: Scenario Outline/Examples expansion is not specified
  by this iteration; existing Gherkin parsing is reused. Deferred features
  remain in `docs/requirements/README.md`.

## Scenario navigation correction

The developer confirmed that selecting a scenario should reveal its associated
unit-test descriptions. The initial report only listed them, with no control.

- RED: Two new renderer tests failed on missing collapsed scenario controls
  and empty-state guidance. The strengthened acceptance scenario failed on the
  missing disclosure markup in the real generated report.
- GREEN: Each scenario now uses a native `details`/`summary` disclosure, closed
  initially, containing its related descriptions. Scenarios with no matching
  tests explain that none ran with a matching lineage ID. No script is needed.
- Validation: build passed; all 18 acceptance scenarios (97 steps) and all
  41 unit tests passed, including the two new regression tests.
- Browser inspection of the user's local report tab was blocked by the
  browser's local-file URL policy. Tests verify the generated native HTML
  control and content; no live browser-click verification is claimed.
