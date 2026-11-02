# Agent Intent

![Agent Intent logo](assets/agent-intent-logo.png)

Navigate from executable Gherkin specifications to the BDD unit tests that support
them. Running the tests generates an HTML report. Review specification changes
individually against the last accepted definitions in `intentdd.lock.json`.

Every Gherkin scenario is a specification; no additional intent classification
is required. Shared lineage tags connect scenarios and unit tests.

## Run locally

Requires **Node.js 24.19+**. Build and test the framework:

```sh
npm ci
npm run build
npm test
npm run test:lineage
npm start
```

Stop this project's local server with `npm stop`. For a custom port, use
`npm stop -- --port 9000`. The command requires `lsof` and `ps` (macOS/Linux),
checks the listener's command and working folder, and sends SIGTERM only to
this project's Agent Intent server. If nothing is listening, it exits successfully.

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
node /path/to/runtime/cli.cjs --root /path/to/project serve --port 8765
node /path/to/runtime/cli.cjs --root /path/to/project status
node /path/to/runtime/cli.cjs --root /path/to/project verify
node /path/to/runtime/cli.cjs --root /path/to/project spec
```

`spec` renders current Gherkin source. `status` outputs the latest report and
accepted definitions. `verify` rejects source that changed since the report,
failing test outcomes, and specification changes awaiting acceptance. A scenario
without executed related tests remains **Not run**; verification does not claim
coverage or rerun tests.

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
update only that entry in `intentdd.lock.json`. The button is available while the scenario is collapsed; unchanged entries show **Accepted**. Accepting a removal deletes its
lock entry. Other specifications keep their accepted definitions.

Generating another report never advances acceptance. Test outcomes are separate
from specification changes. Added, Modified and Removed markers compare semantic
Gherkin definitions with the accepted lock; source-line shifts alone are ignored.
Inherited Feature, Rule, Background and Examples meaning is included. Renaming a
scenario appears as removal and addition; duplicate names use declaration order.

The portable **`intentdd.lock.json`** stores versioned accepted definitions and
fingerprints. Keep it with your project to share the accepted baseline. The latest
run lives separately in `.intentdd/lineage/latest.json`. Existing local
`.intentdd/lineage/accepted.json` baselines remain readable until the first explicit
acceptance writes the new lock. Once present, the lock takes precedence. Invalid
lock data is rejected rather than replaced with an empty baseline.

The local API rejects stale reports, changed source, stale individual acceptance,
missing mutation tokens and cross-origin requests. It binds to loopback and serves
text-only specification previews with restrictive content security headers.

## Configuration

The reporter reads `.feature` files below `feature_roots` in `.intentdd.json`,
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

To use another configured IDE, add an `editor_url_template` to `.intentdd.json`
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

The command is `agent-intent`. Existing `.intentdd.json`, `intentdd.lock.json` and report directories retain their names. Approval envelopes use `AGENT INTENT APPROVAL` headers; export a fresh review before approving changes from an older export.

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
