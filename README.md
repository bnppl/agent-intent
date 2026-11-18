# Agent Intent

![Agent Intent logo](assets/agent-intent-logo.png)

Navigate from executable Gherkin specifications to the BDD unit tests that support
them. Running the tests generates an HTML report. Review specification changes
individually against the last accepted definitions in `agent-intent.lock.json`.

Every Gherkin scenario is a specification; no additional intent classification
is required. Shared lineage tags connect scenarios and unit tests.

## Install in your project

Requires **Node.js 24.19+**. Install the prebuilt tool from the public repository:

```sh
npm install --save-dev github:bnppl/agent-intent
npx agent-intent --help
```

The lockfile pins the Git commit. To install a specific revision, append
`#COMMIT` to the GitHub dependency. No tool build is needed in your project.
The package provides the CLI and the Node test lineage reporter.

## Start with a project brief

```sh
npx agent-intent init
# Fill in intent.md, then open the URL printed by serve.
npx agent-intent serve
```

Replace the comments in `intent.md` with your project's intent. Under
**Problem statement**, write a short paragraph about the problem, who has it,
and what you want to improve. Under **High-level requirements**, add at least
one hyphen bullet. Use one sentence per piece of functionality or user journey.
Keep the two section headings so Agent Intent can read the brief.

The **Specifications** view shows both levels before any application code,
Gherkin scenarios, or test results exist. Refresh the page after editing the brief.
Once you have a lineage report, the brief appears above the specifications and
their supporting tests. `init` preserves an existing `intent.md`.

## Non-functional requirements and static checks

Non-functional requirements do not need Gherkin specifications or unit tests.
Enforce REST design conventions, coding standards, formatting and type safety
with tooling. Use `npm run check:static` as the single command for all project
static checks, and add future static tools there. Keep `npm test` for functional
behaviour and keep static checker output separate from specification lineage
and acceptance. A non-functional-only change is verified by its tooling checks.

In this checkout, `check:static` runs TypeScript checking and generated-runtime
freshness validation. Run `npm run build` first when runtime source changed.
Consuming projects define the same command using their own installed tools.

## Add executable specifications and tests

Add `.agent-intent.json` in your project root, adapting commands to your actual
build and tests:

```json
{
  "version": 1,
  "feature_roots": ["features"],
  "checks": [
    ["npm", "run", "check:static"],
    ["npm", "run", "build"],
    ["npm", "test"],
    ["npm", "run", "test:lineage"]
  ]
}
```

Each check is an executable followed by its arguments, run in order from the
project root without a shell. A nonzero exit stops the workflow. Configure the
complete checks for your project; the names above are examples, not required
scripts. Use an existing npm script for shell pipelines. Only run configuration
you trust: these commands execute with your user permissions.

For Node's test runner, an example optional script is:

```json
{
  "scripts": {
    "test:lineage": "node --test --test-reporter=spec --test-reporter-destination=stdout --test-reporter=agent-intent/runtime/lineage-reporter.cjs --test-reporter-destination=test-lineage.html tests/*.test.mjs"
  }
}
```

Preserve your project's loaders and discovery paths. This reporter consumes Node
test events. For Cucumber, add the message formatter to capture step evidence
alongside Node results. Jest and Vitest need separate integrations. Specifications without executed
related tests remain **Not run**. Ignore `.agent-intent/lineage/`,
`.agent-intent/server-*.log` and `test-lineage.html` in Git. Keep the human-owned
`agent-intent.lock.json`.

Your everyday command is:

```sh
npx agent-intent start
```

It runs the configured checks, requires a newly generated lineage snapshot,
and leaves the review server running in the background. It prints the URL, PID
and log file, then returns your terminal. Repeating it refreshes the evidence
and reuses this project's existing server. It never accepts specifications.
Your application's `npm start` is yours to define.

```sh
npx agent-intent run                 # checks and fresh evidence, then exit (CI)
npx agent-intent status              # report and server PID/URL (null if stopped)
npx agent-intent stop                # stop only this project's server
npx agent-intent serve               # foreground server for the brief and available evidence
npx agent-intent start --port 9000    # use the same port for status and stop
```

Commands use the current project directory, or explicit `--root PATH`.
`start`, `stop` and `status` require `lsof` and `ps` (macOS/Linux) to check process
ownership. Another project's listener is never reused or stopped. Logs are at
`.agent-intent/server-PORT.log`. Restart after upgrading the installed tool.
`run` requires no acceptance and exits nonzero on check/report failures; use
`verify` separately when CI must also require accepted specifications.

## Develop Agent Intent itself

The local-consumer workflow requirements live in
`features/local_consumer_workflow.feature`, with supporting tests in
`tests/local-consumer-workflow.test.ts` and `tests/packaged-workflow.test.ts`.
They use temporary consuming projects and run with this repository's checks.
Toybox's report covers its game requirements from `intent.md`.

In this repository, run `npm ci`, `npm run build`, then
`npm run intent -- start`. Its configured checks build both runtimes, run static
checks and functional tests, and generate lineage evidence. `npm start` and
`npm stop` are optional shortcuts only in this checkout. Source changes must include both generated bundles.

Open the printed URL, normally [http://127.0.0.1:8765](http://127.0.0.1:8765).
The home page and `/lineage` show the same report.
Local navigation brings the workbench into one report: **Specifications** shows all
scenarios and supporting tests, **Changes** shows only specifications awaiting
acceptance, and **Workflow** explains reporting, individual acceptance and mobile
review. The tab links support browser Back and keyboard navigation. Offline and
mobile exports keep the full report in one readable document.

Expand a scenario to see its
Gherkin specification and associated unit-test descriptions. Shared lineage IDs appear once above the tests. Compact test rows show only
additional tags, omitting tags already supplied by the scenario. Gherkin stays visible
after accepting a specification change. Standalone `test-lineage.html` is also readable
without a server. For offline mobile approval, export a mobile review as described below.

The self-contained runtimes work in ordinary project folders without installing
packages there:

```sh
npx agent-intent --root /path/to/project start --port 8765
node /path/to/runtime/cli.cjs --root /path/to/project status
node /path/to/runtime/cli.cjs --root /path/to/project verify
node /path/to/runtime/cli.cjs --root /path/to/project spec
```

`spec` renders current Gherkin source. `status` outputs the latest report, accepted definitions and server PID/URL. `verify` rejects source that changed since the report,
failing test outcomes, and specification changes awaiting acceptance. A scenario
without executed related tests remains **Not run**; verification does not claim
coverage or rerun tests.

## Inspect end-to-end step evidence

In this checkout, `npm run test:lineage` runs Cucumber and Node tests, then
generates the report even if a Cucumber scenario fails. Expand a scenario and
open a step in **Gherkin specification** to inspect its HTTP requests and
responses, CLI results and assertion comparisons. Each outline example and
retry has its own rows. The same views appear in the local workbench, standalone
HTML and mobile HTML review.

For another project, attach evidence in the executing glue with Cucumber
`this.log(text)` or `this.attach(text, 'text/plain')`. Add
`--format message:PATH` to the Cucumber command and pass that run's absolute
message path to the Node reporter as `AGENT_INTENT_CUCUMBER_MESSAGES`.
Set `AGENT_INTENT_CUCUMBER_ROOT` to the canonical project root. Use a fresh
temporary file for each run and preserve both suites' exit statuses.
See [the project workflow](.agents/skills/agent-intent/references/project-workflow.md#capture-cucumber-step-evidence)
for the full setup. Use synthetic data and redact secrets before logging.

## Link specifications and tests

```gherkin
@test-lineage
Scenario: List unit tests associated with a Gherkin scenario
```

```typescript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('HTML reporting', () => {
  it('lists related descriptions', { tags: ['test-lineage'] }, () => {
    assert.equal(1 + 1, 2);
  });
});
```

Give each scenario a specific lineage ID, and tag supporting tests with only the IDs whose behaviour they exercise. A shared Feature tag associates every matching test with every scenario in that feature; it does not establish scenario coverage. Use multiple IDs only when the assertions support each requirement.

Security and compatibility guarantees also need an explicit scenario. Add missing examples as proposals for human acceptance rather than assigning them to an unrelated broad tag.

Use lower-case lineage IDs: Node normalises its native test tags to lower case.
Tests may have multiple IDs and support several scenarios. The reporter uses
completed test events and their tags, including inherited suite tags; it excludes
skipped tests and suite containers. Native test tags emit an experimental warning.

Run another project's Node BDD tests from that project's root:

```sh
node --enable-source-maps --test --test-reporter=/path/to/runtime/lineage-reporter.cjs \
  --test-reporter-destination=test-lineage.html tests/*.test.mjs
```

The HTML is generated even when tests fail, while the runner retains its failing
exit status. Results have green **Passed**, red **Failed**, or neutral **Not run**
labels. Groups show run status first, then Added, Changed, Unchanged and Removed,
with counts. Empty groups are omitted.

## Accept specification changes

Expand a scenario and inspect **Review specification change**, which displays
accepted and current Gherkin. Choose the inline **Accept** button on the scenario row to
update only that entry in `agent-intent.lock.json`. The button is available while the scenario is collapsed; unchanged entries show **Accepted**. Accepting a removal deletes its
lock entry. Other specifications keep their accepted definitions.

Generating another report never advances acceptance. Test outcomes are separate
from specification changes. Added, Modified and Removed markers compare semantic
Gherkin definitions with the accepted lock; source-line shifts alone are ignored.
Inherited Feature, Rule, Background and Examples meaning is included. Renaming a
scenario appears as removal and addition; duplicate names use declaration order.

The portable **`agent-intent.lock.json`** stores versioned accepted definitions and
fingerprints. Keep it with your project to share the accepted baseline. The latest
run lives separately in `.agent-intent/lineage/latest.json`. Existing local
`.agent-intent/lineage/accepted.json` baselines remain readable until the first explicit
acceptance writes the new lock. Once present, the lock takes precedence. Invalid
lock data is rejected rather than replaced with an empty baseline.

The local API rejects stale reports, changed source, stale individual acceptance,
missing mutation tokens and cross-origin requests. It binds to loopback and serves
text-only specification previews with restrictive content security headers.

## Configuration

The reporter reads `.feature` files below `feature_roots` in `.agent-intent.json`,
defaulting to `features` when configuration is absent:

```json
{
  "version": 1,
  "feature_roots": ["features"]
}
```

Roots are project-relative paths. Traversal, symlinked configuration and symlinks
inside feature roots are rejected. Legacy configuration fields are ignored by
the report workflow.

## Develop from executable specifications

The executable requirements live in `features/`. Keep Gherkin examples, step
vocabulary, protocol drivers and implementation separate. Use red/green TDD for
new behaviour and preserve existing lineage and acceptance assertions when
refactoring.

`npm test` type-checks the project, checks generated bundles, runs Cucumber
acceptance scenarios and exercises the real reporter, CLI and local API in
temporary project folders. After editing source, run `npm run build` and include
both generated runtimes in review. No compiler or package installation is needed
in a project using those bundles.

- `src/core/`: filesystem validation, project configuration and Gherkin parsing.
- `src/lineage/`: reporter, accepted state, report rendering and browser interaction.
- `src/server.ts`, `src/cli.ts`: local interface and project commands.
- `runtime/`: generated self-contained CLI and Node test reporter.
- `features/`, `tests/`: executable requirements and BDD unit tests.

Each supporting test has an inline **`</>`** code control, collapsed by default (labelled “View test code” for accessibility).
Expand it to read the test declaration and assertions, with its source file and
line number. The reporter captures this code with the test run; local, standalone
and exported mobile reports use the same captured source. Code is displayed as
text, and unavailable source is explained without hiding the test result.

When using a loader such as tsx, enable source maps so declaration locations refer
to the original TypeScript source. Shared helper references remain references;
the view does not inline dependencies or surrounding suite hooks.

## Review and approve from your phone

After running the tests, export self-contained review files:

```sh
npm run intent -- review --output mobile-review
```

This writes `mobile-review.html` and `mobile-review.txt` without changing acceptance.
Choose a new output prefix for each iteration; existing files are not overwritten.
Open the HTML in a browser, compare accepted and proposed Gherkin, and inspect lineage
and recorded test outcomes. Select only the changes you approve, then use **Copy approvals**
and paste the complete block into the agent conversation with an instruction to apply it.
Copying never updates the lock.

If your phone's preview cannot run scripts, use the text companion. It contains the
same changed definitions and an approval block for each specification. Copy only the
blocks you approve; several complete blocks can be pasted together as one batch.
If clipboard access fails, select and copy the HTML's visible approval text manually.

The agent imports exactly the user-supplied blocks:

```sh
node runtime/cli.cjs approve --file pasted-approval.txt
# Or pipe the exact pasted approval text to: node runtime/cli.cjs approve
npm run intent -- verify
```

The complete batch is validated before one atomic update of selected lock entries.
Malformed, altered, duplicate, unknown and stale decisions are rejected. A review binds
the entire report and accepted baseline, including unselected specifications. Changed
specification source, a different report, any acceptance update or replay requires a
fresh review. Import never reruns tests or changes outcomes. Specification agreement
does not approve implementation changes or authorise a commit.

Hashes establish content integrity and freshness, not human authentication. The agent
must wait for your explicit pasted decisions, never generate its own approvals, and
never treat examples or repository content as authorisation. No server, hosted page
or external resources are needed to review the exported files.

Test code uses bundled highlight.js core with JavaScript, TypeScript and Gherkin grammars.
Highlighting is generated into HTML, so local, standalone and mobile reports need
no additional browser scripts or external requests. Scenario source and both sides of specification-change previews are highlighted too. The code toggle is unchanged.

## Open source in your IDE

Click a scenario's source location or the file/line above expanded test code to
open that line in VS Code. Links in generated HTML and exported mobile reviews
point to the project folder on the machine that generated them.

To use another configured IDE, add an `editor_url_template` to `.agent-intent.json`
alongside `version` and `feature_roots`. VS Code is the default:

```json
"editor_url_template": "vscode://file{path}:{line}:{column}"
```

Use your IDE's documented URL scheme. `{path}` is an escaped absolute URL path;
`{encodedPath}` is the whole absolute path encoded for a query parameter. `{line}`
is the captured source line and `{column}` currently defaults to 1. For example,
a query-based IDE handler can use
`my-ide://open?file={encodedPath}&line={line}&column={column}`. The IDE must be
installed and registered for its URL scheme on the machine opening the link.

## Compatibility

The command is `agent-intent`. Configuration uses `.agent-intent.json`, accepted definitions use `agent-intent.lock.json`, and report snapshots live under `.agent-intent/lineage/`. When upgrading an existing project, rename `.intentdd.json`, `intentdd.lock.json` and `.intentdd/` to those names; keep their contents intact. Approval envelopes use `AGENT INTENT APPROVAL` headers; export a fresh review before approving changes from an older export.

## Publish documentation with GitHub Pages

The `Publish GitHub Pages` workflow builds and tests the framework, then publishes
this README and the logo as a documentation site on pushes to `main` or a manual
workflow run. In repository **Settings → Pages → Build and deployment**, select
**GitHub Actions** as the source before the first deployment. The deployment's
`github-pages` environment links to the published site.

`npm run pages:prepare` stages the homepage and assets in `.pages-source/` for
Jekyll. Only that documentation output is uploaded; reports, approval envelopes
and local project state are excluded. The hosted site documents the framework;
run the CLI locally to generate reports and review specification changes.

## Link specifications to high-level requirements

Give requirements stable IDs in `intent.md`:

```markdown
- **REQ-001** Provide a choice of building toys.
```

Use `@req-001` on the corresponding Gherkin Feature, Rule or Scenario.
The last requirement tag wins, so a scenario tag overrides an inherited tag.
Use one unique ID per requirement and one effective requirement per scenario.
The specifications view nests scenarios under requirements, preserving test-result
and acceptance groups within each requirement. Requirements with no specifications,
legacy bullets without IDs and specifications with missing or unknown links remain
visible. Changing a requirement sentence preserves its link when its ID stays the same.
Existing scenario lineage tags continue to connect supporting tests. The Changes
view remains a single list for reviewing pending decisions.

With a project brief, the report overview shows only the problem statement and
requirement entries. Open a requirement to see its specifications, open a
specification to inspect its Gherkin and evidence, and use Back to move up one
level. This navigation uses native HTML disclosures and also works offline.

## Drill from a step into components

Keep the complete end-to-end scenario and its own lineage ID. On a supporting
Feature, Rule or Scenario, add `@supports:<parent-lineage-id>:<step-number>`:

```gherkin
@e2e @choose-item
Scenario: Choose an item
  Given items are available
  When I select an item
  Then my choice is shown
```

```gherkin
@api @supports:choose-item:1
Feature: Provide available items
  @list-items-api
  Scenario: List available items
    When I request the available items
    Then the response contains those items
```

A frontend feature can use `@frontend @supports:choose-item:1` with its own
scenario lineage IDs. `@e2e`, `@api` and `@frontend` label the layer; they and
`@supports:…` are metadata rather than shared test lineage. Tag each test with
the specific scenario lineage ID it exercises.

Step numbers start at one in displayed Gherkin order, including feature and rule
background steps. The parent ID must identify exactly one scenario. A step link
opens a separate supporting-feature view even before any step logs exist. The
view groups scenarios by feature file and retains each scenario's result, source,
logs and individual acceptance controls. Back returns to the originating step;
further supporting links can be explored in the same way. Supporting results
never replace the complete parent scenario's test result. Valid linked scenarios
are reached through their parent instead of also appearing in the root list;
the Changes view still includes every pending specification independently.
Missing or ambiguous parents, invalid step numbers and cycles produce visible
diagnostics. Reports without support metadata retain their existing navigation.

Dogfooding friction: a recorded step could previously reveal only glue logs, so
reviewing the enabling API and frontend required scanning unrelated root
specifications. Supporting-feature links now expose that relationship directly.
A future improvement could offer an authoring-time check for stale step numbers
when parent Gherkin steps are inserted or reordered.

Report navigation follows the same outline at every level: requirement, scenario,
components, component feature, component scenario, and captured step evidence.
Back returns one level and retains the original evidence and review controls.

Use an inherited Gherkin tag such as `@component:Game-API` or
`@component:Web-App` to group supporting features by component. Hyphens become
spaces in the report label. Component names are project-defined metadata and
never count as test lineage IDs. Untagged features remain under Other components.

Dogfooding note: returning from captured step evidence left its disclosure open,
so revisiting several steps cluttered the scenario with logs. Returning now
collapses the step again. Agent Intent should keep regression coverage for
both entering evidence and returning to the scenario overview.

The interactive report uses the same disclosure pattern at each abstraction
level. Chevron clicks expand requirements, scenarios, steps and BDD unit tests
in place. Title links open a focused report URL (`#spec=…`) with that
specification at the top; Back restores the hierarchy. Component scenarios
linked with `@supports:<parent-lineage-id>:<step-number>` occur beneath that
parent step, grouped by `@component:<name>`, and can have their own supporting
scenarios. A parent keeps its own execution result. Unit specifications use
BDD `describe`/`it` names and retain source code, declaration links, failure
information and `t.diagnostic()` messages from the actual run. Existing tests
without recorded diagnostics explicitly say that no logs were recorded.
Cucumber evidence links to the captured step-definition source line.

Dogfooding friction: the previous drilldown used different layouts for component
features, scenarios and test code. A shared recursive disclosure layout now
keeps the abstraction hierarchy visible. The browser regression exercises both
inline expansion and focused title navigation, including returning to the
original expansion state. New specification proposals remain unaccepted.
A unit test can target a particular parent step using the Node test tags
`supports:<parent-lineage-id>:<step-number>` and `component:<name>`. It then
appears inside that step's component group. Tests sharing a scenario's lineage
ID without step metadata remain dependencies of the whole scenario; the report
does not invent a step relationship for them.

Dogfooding friction: the fractal navigation ready flag did not match the CSS
fallback selector, leaving a full-width sticky outline above the report. The
fallback now recognises both navigation implementations. A browser regression
checks separate outline/content regions while scrolling at four viewport widths,
including expanded mobile navigation, and checks breadcrumb containment.

Deep links also address component groups and individual Gherkin steps. Use the
component or step title link to focus that abstraction level, then copy the URL.
The same URL opens directly in a fresh tab and survives reload; breadcrumbs
retain its requirement, parent scenarios, steps and component ancestry. The
left chevron continues to expand a step inline.

Dogfooding friction: focused URLs previously handled scenarios and unit tests
but silently fell back to the project for a step or component. Navigation now
recognises those levels too, with browser coverage for fresh loads and reloads
across all five target types.

### Scenario outline execution tabs

Executed outlines show one tab per example and retry attempt. Each tab contains
that run's concrete Gherkin, step results and recorded logs. Values are also
substituted in data tables and doc strings; acceptance still compares the
original template and Examples definitions. Shared nested specifications are
linked at the owning step in every example tab. Arrow keys, Home and End switch
tabs. Standalone exports keep all example content available when scripts are
disabled.

Dogfooding note: Toybox's material-combination examples exposed how merged
per-step logs made individual runs hard to review. Run-level tabs address this;
example values now travel with execution evidence rather than changing the
accepted specification fingerprint.

## Implementation decision inbox

Open **Decisions** in the local report to review implementation choices separately
from specification changes. Proposals are grouped by journey and component;
unresolved items remain visible and do not block specification review or `verify`.
A human records **Protect behavior** or **Allow implementation flexibility**, with
an explicit scope and rationale. Flexibility never overrides an accepted requirement.
Protect records work needed on a contract/test; it does not create tests or establish
coverage. Specification approval still uses the existing acceptance workflow.

Import a proposal batch with `npm run intent -- decisions --file proposals.json`:

```json
{
  "version": 1,
  "items": [{
    "id": "material-order",
    "title": "Material ordering",
    "journey": "Choose three pieces",
    "component": "Web App",
    "specification": "@select-three-building-pieces",
    "evidence": "Catalogue order and alphabetical order both preserve selection quantities."
  }]
}
```

IDs identify proposals across imports. Imports merge rather than delete omitted
items. They cannot supply human classifications. The specification reference is
shown for context, not automatically verified as a valid link. Review relevant
contracts before granting flexibility. Human decisions and evidence are stored
in `.agent-intent/decisions.json`, independently of `agent-intent.lock.json`.
Keep this decision record in version control if it should travel with the project.
Changed proposal content reopens classification while preserving the previous
decision for comparison. Identical imports preserve current classifications.
Concurrent or outdated submissions are rejected without writing state.

For mutation evidence, run your chosen mutation engine separately and import its
Mutation Testing Elements JSON output (schema version 1 or 2):

```sh
npm run intent -- mutations --file reports/mutation/mutation.json
npm run intent -- serve
```

This boundary adapter validates the fields used by the inbox; it is not a complete
JSON Schema validator. `Survived` and `NoCoverage` findings become unresolved
proposals under **Unmapped mutation findings**, grouped by source file. Evidence
includes mutation details, bounded source context and a source fingerprint.
Other outcomes do not become flexibility proposals. Tool failures and equivalent
mutations must be investigated separately; survival alone is not evidence that a
change is permissible. Source changes reflected in a new import reopen review.
The importer does not run mutation engines, infer requirements links, remove older
findings, or certify that a report still matches the current checkout. Re-import
fresh evidence and review it against current contracts before classifying.

Decisions currently require the local interactive report. Offline specification
exports retain their existing scope and do not classify implementation decisions.
The local session token and revision checks prevent accidental cross-origin and
stale writes; they do not authenticate a human independently of same-user processes.
Agents must propose choices and leave classification to the human.
