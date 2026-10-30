# Intent DD

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

Open the printed URL, normally [http://127.0.0.1:8765](http://127.0.0.1:8765).
The home page and `/lineage` show the same report. Expand a scenario to see its
Gherkin specification and associated unit-test descriptions. Each supporting test
displays the matching lineage ID from its native test tags. Gherkin stays visible
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

Use lower-case lineage IDs: Node normalises its native test tags to lower case.
Tests may have multiple IDs and support several scenarios. The reporter uses
completed test events and their tags, including inherited suite tags; it excludes
skipped tests and suite containers. Native test tags emit an experimental warning.

Run another project's Node BDD tests from that project's root:

```sh
node --test --test-reporter=/path/to/runtime/lineage-reporter.cjs \
  --test-reporter-destination=test-lineage.html tests/*.test.mjs
```

The HTML is generated even when tests fail, while the runner retains its failing
exit status. Results have green **Passed**, red **Failed**, or neutral **Not run**
labels. Groups show run status first, then Added, Changed, Unchanged and Removed,
with counts. Empty groups are omitted.

## Accept specification changes

Expand a scenario and inspect **Review specification change**, which displays
accepted and current Gherkin. Choose **Accept this specification change** to
update only that entry in `intentdd.lock.json`. Accepting a removal deletes its
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

Expanding a unit-test description to show its logic remains a
[future feature](docs/requirements/README.md#future-features).

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
