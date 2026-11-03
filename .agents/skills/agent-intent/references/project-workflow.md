# Project commands and lineage

Use this workflow when the user wants their agent to manage requirements, tests,
reports or the review service in a project consuming Agent Intent.

## Establish the project commands

Inspect the project's scripts, runtime version and tests. Install the prebuilt
public package as a development dependency with
`npm install --save-dev github:bnppl/intent-dd`. Preserve the project's package
manager and lockfile. Use Node 24.19+. Do not take over `npm start` or `npm test`.
A linked source checkout remains supported but must be built in its own directory.

Use `npx agent-intent` from the consuming project root. Configure explicit check
commands in `.agent-intent.json`, adapting this example to the project's checks:

```json
{
  "version": 1,
  "feature_roots": ["features"],
  "checks": [
    ["npm", "run", "build"],
    ["npm", "test"],
    ["npm", "run", "test:lineage"]
  ]
}
```

Checks are executable/argument arrays, run in order without a shell. They execute
with user permissions; inspect configuration before running it. A failed check
stops the sequence. The sequence must generate a fresh lineage report. Pending
specification acceptance does not block `run` or `start`.

An optional Node test runner script is:

```json
{
  "scripts": {
    "test:lineage": "node --enable-source-maps --test --test-reporter=spec --test-reporter-destination=stdout --test-reporter=agent-intent/runtime/lineage-reporter.cjs --test-reporter-destination=test-lineage.html tests/*.test.mjs"
  }
}
```

Only add the real-test command once its discovery path matches actual tests.
Prebuilt installations do not need build hooks. Preserve the project's test loader, discovery paths and
existing checks. TypeScript tests may need the project's `--import tsx` setup.
The lineage reporter consumes Node test events: do not attach it directly to
Jest, Vitest or Cucumber and claim their results are recorded. Retain those
suites and explain any additional Node supporting-test suite or integration
needed. Do not silently migrate an established test framework.

Keep `.agent-intent.json` as a regular project file with
`{"version":1,"feature_roots":["features"]}` when these are the intended roots.
Ensure the roots exist and do not link the tool's own feature directory into
them. Ignore `.agent-intent/lineage/` and `test-lineage.html` in Git; preserve the
human-owned `agent-intent.lock.json`. If legacy `.intentdd` names exist, follow
the linked tool README's migration guidance and preserve their contents.

## Requirements-only review

Before application tests exist, create `scripts/report-requirements.mjs`:

```js
import { writeFile } from 'node:fs/promises';
import reporter from 'agent-intent/runtime/lineage-reporter.cjs';

async function* noTestEvents() {}
let html = '';
for await (const chunk of reporter(noTestEvents())) html += chunk;
await writeFile('test-lineage.html', html);
console.log('Requirements report generated. No tests ran; specifications remain unaccepted.');
```

Run `node scripts/report-requirements.mjs` yourself. This uses the actual reporter with zero
test events; it produces a review snapshot and HTML, with scenarios **Not run**.
Do not create dummy passing tests to populate the report. Once tests exist,
generate reports with their test run instead. Never fall back to this command
after a failing test run: it replaces the latest snapshot and its test evidence.

## Generate meaningful tests and lineage

When asked to generate tests, read each scenario, Background and Examples table.
Map each scenario to assertions of its observable behaviour, covering each example,
negative case and boundary. Keep unresolved product decisions explicit. Do not
implement an application merely because the user requested requirements review
or tests; keep new tests failing for missing behaviour when implementation is
outside scope, and report the failures accurately.

Give each scenario a specific lower-case lineage tag and attach that ID to the
Node tests whose assertions exercise it, for example:

```js
it('rejects a request overlapping an existing reservation',
  { tags: ['reject-overlapping-booking'] }, () => {
    // Call the actual booking API/domain and assert rejection and unchanged state.
  });
```

This illustrates tag syntax, not a complete test: write real setup, calls and
assertions against the application. Do not tag trivial checks, feature parsing
or file-existence tests as evidence of booking behaviour. Do not copy the tool's
tests into the consumer. Use several tests for a scenario when needed; sharing a
broad tag across unrelated scenarios does not establish coverage.

Observe each new behaviour test fail for its intended missing behaviour before
implementing it, when implementation is authorised. Missing imports, syntax
errors or broken infrastructure are not a meaningful behaviour failure. Run the
project's relevant checks, then `npm run test:lineage`. Preserve the command's
failing exit status and inspect both terminal outcomes and the report snapshot.
Confirm expected scenarios and matching test tags are present; report any
**Not run**, failing or pending scenarios. Do not claim a scenario outline is
fully exercised just because one example has a tagged test. Rebuild and rerun
after source changes so review does not use stale evidence.

## Serve and share the result

Run `npx agent-intent start` when the user requests checks and the review service.
It runs the configured checks, requires fresh evidence, then starts a detached
server or refreshes this project's existing server. Check the printed URL with a
read-only page request. Use `npx agent-intent run` for checks without a server,
`npx agent-intent status` for report and server status, and
`npx agent-intent stop` to stop this project's server. Managed service commands
require `lsof` and `ps` on macOS/Linux. Use the same `--port PORT` for start,
status and stop. Logs are `.agent-intent/server-PORT.log`; ignore these in Git.
Another project's listener is never reused or stopped. Restart after tool upgrades.

For requirements-only review, generate the explicit requirements report first,
then run `npx agent-intent serve` in a foreground/session process. Do not configure
a requirements-only report as a substitute for test evidence. Foreground `serve`
does not run checks. No command accepts specifications automatically.

For offline/mobile review run `npx agent-intent review --output PREFIX` with a
fresh prefix and share both generated files. Report what ran, failures and
unexecuted scenarios, pending specification decisions, and the usable report URL
or file. Run `npx agent-intent verify` after explicit acceptance imports; pending
acceptance before that is expected and is separate from test failure.

Generating tests, running commands and displaying reports never accepts a
specification. Follow the main skill's explicit approval-envelope requirements.
