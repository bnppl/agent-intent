# Intent DD

Build AI-assisted software from a human-owned executable specification. Intent DD uses its own Gherkin contract to develop and test itself. The implementation, browser client, and Cucumber-JS glue are TypeScript; Python is not required.

## Three tools, one contract

| Tool | Responsibility |
| --- | --- |
| [Developer skill](.agents/skills/intent-dd/SKILL.md) | Guide behavioural examples, implementation, and human-owned changes in meaning. |
| Local web workbench | Read real `.feature` files and write `@intent` annotations directly into source without an agent. Review the exact staged diff. |
| Pre-commit verifier | Compare committed HEAD with the Git index; block changes to intent specifications, glue/support, and verification controls without explicit local approval for that revision. |

Only Gherkin classification is supported. One marked scenario protects its **whole feature file** and the **complete configured glue/support pool**, including shared steps, hooks, helpers, new registrations, file modes, renames, and deletions. This deliberately over-protects; it does not infer a dependency call graph. Glue can be written in any language.

## Run locally

Requires **Node.js 24+ and Git**. The committed, self-contained JavaScript bundle runs without installing packages:

```sh
npm run intent -- install-hook
npm start
```

Open the printed URL, normally **http://127.0.0.1:8765**. The server binds only to loopback and checks the exact Host and Origin. Keep it running while using the browser. In a remote container, forward the port to the same local URL. No AI or external service participates in annotation or approval.

Equivalent direct commands, without npm:

```sh
node runtime/cli.cjs install-hook
node runtime/cli.cjs serve --port 8765
```

The installation must already be committed: the hook loads `runtime/cli.cjs` from **HEAD**, never the working or staged candidate bundle. Existing unrelated hooks and `core.hooksPath` configurations are preserved; installation refuses to overwrite or silently reconfigure them.

## Development and validation

```sh
npm ci
npm run build
npm test
```

`npm test` type-checks shared contracts, verifies the tracked bundle matches source, runs the unchanged Gherkin acceptance specification through Cucumber-JS, and exercises the actual local API and Git hook in temporary repositories. There are no Python tests or Python runtime dependencies.

After editing TypeScript or web assets, run `npm run build` and include the `runtime/cli.cjs` change in review. `npm run build:check` detects drift without modifying the bundle. The hook never installs dependencies, invokes a compiler, or fetches packages. Parser and UI assets are embedded into the bundle. The lockfile pins build/test dependencies; builds contain no timestamp or machine-specific absolute paths.

## Working loop

1. Define one small Gherkin example and review its meaning with a human.
2. Open the local workbench. Toggle **Mark as intent** to write `@intent` into the actual scenario source. Other tags and line endings are preserved. Nothing is automatically staged or committed.
3. Observe a new behaviour's acceptance test fail, implement it, then run the suite. For refactors, use green-before/green-after checks without fabricating a failure.
4. Stage intentionally. Inspect the **Staged review** tab: the complete staged diff, protected paths, HEAD, and index tree SHA.
5. For protected changes, a human supplies their name, rationale, and the exact phrase `APPROVE INTENT CHANGE`.
6. Commit the reviewed revision. Any additional staging or a new HEAD invalidates approval.

New intent and removal of an intent tag also require acceptance. Feature-, Rule-, and Examples-level intent is inherited. A child toggle cannot remove inherited protection: edit the parent tag in source and review it. The official Gherkin parser handles Scenario Outlines, Examples, Backgrounds, data tables, docstrings, and language keywords; protection compares exact source bytes.

## Build this tool from its own specification

[features/intent_workflow.feature](features/intent_workflow.feature) is retained byte-for-byte from the Python prototype. It expresses the 17 acceptance scenarios independently of the implementation language. Its TypeScript glue uses domain vocabulary and a protocol driver to exercise real temporary Git repositories, the CLI, and the HTTP API.

```sh
npm run test:acceptance
npm run intent -- spec
npm run intent -- status
npm run intent -- verify
```

`spec` renders the **committed** Gherkin intent as an agent bootstrap prompt, avoiding a separately maintained prose specification. Inspect working changes separately. The initial agent-drafted contract still needs human acceptance in the implementation PR; an `@intent` annotation does not prove that acceptance already happened.

## Configure complete glue coverage

`.intentdd.json` defines the boundary:

```json
{
  "version": 1,
  "feature_roots": ["features"],
  "glue_roots": ["features/steps", "features/support", "features/hooks.ts"],
  "control_paths": ["src", "runtime", "scripts", ".intentdd.json", ".agents", "AGENTS.md", "package.json", "package-lock.json", "tsconfig.json", "cucumber.mjs", ".github", ".githooks"]
}
```

Include **every runtime glue directory, imported test helper, and lifecycle hook** in `glue_roots`. Include runner/discovery configuration, dependency manifests, and other test controls in `control_paths`. Paths are repository-relative, not glob expressions. The system under test should remain outside the glue boundary so its implementation can evolve.

The verifier considers the union of old and new boundaries; removing a root cannot hide a staged change. Core verification paths and configuration are always protected. Missing glue for an intent contract, malformed Gherkin, unresolved merges, unsafe paths, and symlinked glue/spec files fail closed.

To adopt the tool in another repository, vendor the reviewed `runtime/cli.cjs` bundle and configuration, commit the installation, then run `node runtime/cli.cjs install-hook`. Source and build tools are only needed if you plan to develop the tool there. Review that repository's complete glue boundary before relying on it.

## Hook and approval trust

The hook installs a loader outside tracked source. The loader extracts HEAD's committed bundle into a temporary directory, clears `NODE_OPTIONS` and `NODE_PATH`, and invokes it with the installed Node executable. Staged source or bundle changes cannot replace the running check. Keep that Node executable installed. Verification does not execute repository glue.

Approval is stored under the repository's Git directory, outside tracked source. A local key signs a versioned record bound to HEAD and the entire index tree. There is no CLI approval switch. A tracked manifest cannot supply approval, and old Python-format approvals are intentionally not replayed. This is local workflow metadata, not an independently authenticated human signature.

The server validates request bodies at runtime as well as sharing TypeScript types with the browser. It uses a per-session mutation token, Host/Origin checks, no CORS, no-store responses, a restrictive content security policy, and text-only source rendering. Stale annotation hashes and stale review revisions are rejected.

**Local Git hooks cannot enforce a security boundary against a same-user agent.** Such a process can bypass a hook, modify `.git` state, or operate the local API. The skill explicitly forbids these escape routes. Stronger enforcement needs protected CI and independently authenticated human approval for the exact revision, without agent approval or bypass privileges. That remote integration is not implemented here.

Coverage is only as complete as the configured glue/support/control roots. Dynamic imports and external helpers outside that boundary are not automatically discovered. Source-change detection does not execute tests or prove their correctness.

## Migrating an existing Python checkout

1. Check out the reviewed TypeScript revision. Keep the original Gherkin source.
2. Install Node.js 24+; remove the Python virtualenv only when no other project needs it.
3. Run `npm run intent -- install-hook` after the TypeScript bundle is committed in HEAD. The installer recognizes and replaces its own previous Python loader, while preserving unrelated hooks.
4. Restart the local server with `npm start`. Old local approvals require fresh review with the TypeScript tool.

The earlier Python implementation and browser-only concept remain available in Git history. They are removed from the active tree so there is one runnable workbench.

## Source layout

- `src/core/`: Git snapshots, Gherkin parsing/annotation, deterministic verification, and shared types.
- `src/server.ts`, `src/cli.ts`, `src/hook.ts`: local API, commands, and trusted hook installation.
- `src/web/`: typed browser client, HTML, and CSS.
- `runtime/cli.cjs`: committed self-contained runtime, generated from the source above.
- `features/`: retained specification, TypeScript glue, and protocol driver.
- `tests/`: hook, HTTP, annotation, approval, and cross-language glue regression tests.
- `.agents/skills/intent-dd/`: repository developer skill.

Inspired by [Dave Farley's four-layer acceptance-testing architecture](https://continuous-delivery.co.uk/downloads/ATDD%20Guide%2026-03-21.pdf). Intent classification and local approval are this project's design, not an official Farley product.
