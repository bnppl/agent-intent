# Intent DD

Build AI-assisted software from a human-owned executable specification. Intent DD uses its own Gherkin contract to develop and test itself.

## The three tools

| Tool | Responsibility |
| --- | --- |
| [Developer skill](.agents/skills/intent-dd/SKILL.md) | Guide the developer from behavioural examples to implementation. Never self-approve changes in meaning. |
| Local web workbench | Read real `.feature` files and write `@intent` annotations directly to source, without an agent. Review the exact staged diff. |
| Deterministic pre-commit verifier | Compare committed `HEAD` to the Git index; block changes to intent specifications, glue/support, or verification controls without explicit local human approval. |

Only Gherkin classification is supported by the local tool in this version. Glue protection is language-independent and deliberately conservative: **one marked scenario protects its whole feature file and the complete configured glue/support pool**. This includes new registrations, shared steps, hooks, helpers, file modes, and deletions. It may require review for unrelated glue changes. It does not infer a call graph.

## Quick start

Requires Python 3.10+ and Git. From a clone of this repository:

```sh
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements.lock
python -m intentdd install-hook
python -m intentdd serve
```

Open the printed URL, normally **http://127.0.0.1:8765**. Keep that command running while using the view. It binds only to loopback. The URL must use `127.0.0.1`, with the printed port, because Host and Origin are checked. No AI or external service participates in annotation or approval.

When using a remote development container, forward the port and run the browser on the same loopback URL. The old deployed static demo cannot edit a local checkout or run this server.

## Developer workflow

1. Define one small example in a `.feature` file and review its meaning with a human.
2. Open the local workbench. Toggle **Mark as intent**. The server writes `@intent` into the real file, preserving other tags and line endings. It never stages or commits.
3. Observe the acceptance test fail, implement the behaviour, and run the tests.
4. Stage intentionally with Git. The **Staged review** tab shows the complete staged diff, affected protected paths, HEAD, and index tree SHA.
5. When protected content changes, a human enters their name, rationale, and `APPROVE INTENT CHANGE` in the local view.
6. Commit. The hook verifies the same staged revision. Any further staging or a different HEAD invalidates the approval.

New intent and removal of an intent tag also require acceptance. Feature-, Rule-, and Examples-level tags are recognized as inherited protection. The view cannot remove inherited intent from a single child; edit the parent tag explicitly and review that source change. Scenario Outlines, Examples, Backgrounds, data tables, docstrings, and Gherkin languages are parsed by the official Cucumber parser. The whole-feature boundary protects their source without approximating their semantics.

## Configure the glue boundary

`.intentdd.json` is a committed configuration:

```json
{
  "version": 1,
  "feature_roots": ["features"],
  "glue_roots": ["features/steps", "features/support", "features/environment.py"],
  "control_paths": ["intentdd", ".intentdd.json", ".agents", "AGENTS.md", "requirements.txt", "requirements.lock", "pyproject.toml", ".github", ".githooks"]
}
```

**Include every runtime glue location and imported test helper in `glue_roots`.** For example, a Cucumber project may use `features/step_definitions` instead of `features/steps`. Include runner/discovery configuration, dependency manifests, and other relevant test controls in `control_paths`. The tool protects the union of old and new boundaries, so weakening configuration cannot hide a change. Core verifier paths and config are always protected.

The system under test belongs outside the glue boundary so implementation can evolve. Missing glue for an intent contract, malformed Gherkin, unresolved merges, unsafe paths, and symlinked glue/spec files fail closed. Missing dependencies also make the hook fail.

Changing another unmarked scenario in a feature that contains intent still requires review. Changing any configured glue file while intent exists still requires review. A future adapter can narrow this to validated per-scenario step dependencies; this version chooses over-protection.

To adopt Intent DD in another repository, vendor `intentdd/` and its dependency files, configure the roots, and commit that installation for human review before installing the hook. The loader requires the verifier in the target repository's HEAD; it does not silently trust a separate mutable checkout. Run commands from the vendored repository, or pass `--repo /path/to/repository` while running from the tool checkout.

## Build the tool from its own specification

[features/intent_workflow.feature](features/intent_workflow.feature) is this tool’s executable specification. Its steps use a domain vocabulary; a protocol driver exercises real temporary Git repositories, CLI subprocesses, and the real local HTTP API. No fixture invokes an AI.

The initial `@intent` suite is drafted by the agent and needs human acceptance in the implementation PR. A tag is not evidence that a person already approved its meaning.

```sh
# Execute the Gherkin specification
python -m behave features/

# Generate an agent bootstrap prompt from committed intent
python -m intentdd spec

# Inspect and verify the exact staged contract
python -m intentdd status
python -m intentdd verify

# Regression tests, including real git commit hook execution
python -m unittest discover -s tests -p 'test_*.py'
node tests/review.test.cjs
```

The `spec` command reads committed Gherkin source rather than maintaining a second prose specification that can drift. Extend the executable examples first when adding behaviour.

## Hook and approval mechanics

The installed hook is a loader outside tracked source. On each commit it extracts the verifier’s Python modules from **HEAD** into a temporary directory and runs that committed version in isolated Python mode. Candidate verifier changes cannot replace the running check. The selected virtualenv interpreter must remain installed. Existing hooks and `core.hooksPath` configuration are preserved; installation refuses to overwrite or silently reconfigure them.

Approval is stored under the repository’s Git directory, outside tracked source. A locally generated key signs the record; verification binds it to HEAD and the entire index tree. It cannot be carried to another revision or supplied by editing a tracked JSON manifest. There is no CLI `--approve` bypass. The browser does not stage or commit anything. This is local audit metadata, not a remotely authenticated signature by a named person.

The HTTP server uses a per-session mutation token, strict Host/Origin checks, same-origin requests, no CORS, no-store responses, and a restrictive content security policy. All source is rendered as text. Annotation requests reject stale file hashes, unsafe paths, and symlinks.

## Enforcement limits

**A pre-commit hook is a local workflow guard, not a security boundary against a same-user agent.** Anyone with the same OS/Git privileges can use `--no-verify`, edit `.git` state, replace the hook, or call the local review API. The local UI authenticates a session, not a human identity. The skill explicitly forbids the agent from using those escape routes. HMAC signing does not change that same-user boundary.

For mandatory enforcement against an autonomous agent, run a trusted verifier in protected CI and require independently authenticated human approval tied to the exact candidate revision, with agent approval/bypass privileges removed. That remote review integration is not implemented here. Do not treat local approval files as proof of human authorization in CI.

Coverage is only as complete as the configured glue/support/control roots. Dynamic imports or external helpers outside those roots are not automatically discovered. Review the boundary when adopting the tool. The verifier detects protected source changes; it does not execute tests or prove they are correct.

## Source and inspiration

- `intentdd/`: repository reader, Gherkin parser, verification, hook installer, local server, and web UI.
- `features/`: the tool's executable contract, glue, and protocol driver.
- `.agents/skills/intent-dd/`: repository developer skill.
- `tests/`: hook, API, annotation, verification, and earlier prototype regression tests.
- `dist/`: the earlier browser-only concept demo, retained for reference. It is not the local editor or the enforcement mechanism.

Inspired by [Dave Farley’s four-layer acceptance-testing architecture](https://continuous-delivery.co.uk/downloads/ATDD%20Guide%2026-03-21.pdf): domain test cases, domain-specific language, protocol drivers, and system under test. The intent annotation and approval protocol are this project's design, not an official Farley tool.
