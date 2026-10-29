# Intent DD

An HTML workbench for AI-assisted software development that keeps human-owned intent separate from AI-editable implementation.

Inspired by [Dave Farley’s four-layer acceptance-testing architecture](https://continuous-delivery.co.uk/downloads/ATDD%20Guide%2026-03-21.pdf): test cases → domain-specific language → protocol drivers → system under test. This project adds its own intent classification and review workflow; it is not an official Farley tool. The precise recent article has not yet been identified.

## Run

No dependencies or build step:

```sh
python3 -m http.server 8000 --directory dist
```

Open http://localhost:8000. Use localhost or HTTPS for SHA-256 policy export, which uses the Web Crypto API. Browser state is local to the origin. Export a workspace backup before switching hosts or clearing browser data.

## Features

- Gherkin scenarios, unit tests, and supporting artifacts in one library.
- Intent classification independent of architectural layer and syntax.
- Protected edits, renames, deletions, and reclassification submitted as proposals.
- Accepted source remains unchanged while a proposal awaits review.
- Exact-revision approval, stale-revision rejection, reviewer rationale, and local history.
- Source-file import, workspace JSON backup/restore, search, and filters.
- Export SHA-256 policy, a Python change detector, and AI development instructions.
- Illustrative tennis-booking examples. Imported source is text only; the app does not execute tests.

Protection covers an entire file. Split mixed files when only some tests need protection. An `@intent` annotation alone does not establish a protected baseline. Classify the artifact in the workbench.

## Trust boundary

This is a **browser-local prototype**, not an authenticated approval service. Reviewer names are self-declared; browser data and decisions can be edited. No GitHub integration or test runner is built into the application.

The exported checker detects changed, missing, renamed, or symlinked protected files. It must run from trusted CI against the **base-branch policy**, not a manifest or checker supplied by the candidate change:

```sh
python3 /trusted/check_intent.py --policy /trusted/base/intent-policy.json --root .
```

The checker fails for any protected file change. Approving a change in the browser does not unblock repository CI. A human must explicitly approve the corresponding repository change and baseline update through a protected process.

Configure required trusted checks and code-owner review for intent files, policy, checker, and workflows. Dismiss stale approvals, prevent agent approvals and bypasses, and keep CI credentials away from untrusted code. Repository rules are intentionally not configured by this prototype. File hashes do not detect every indirect weakening through unprotected fixtures, discovery configuration, or dependencies. Protect supporting artifacts when appropriate and run the actual tests separately.

Fingerprints compare UTF-8 source bytes exactly, including line endings. Avoid reformatting on import/export. Pending proposals are excluded from policy exports.

## Validate

Requires Node.js and Python 3; no third-party packages:

```sh
node --check dist/app.js
node tests/review.test.cjs
python3 -m unittest discover -s tests -p 'test_*.py'
```

The tests exercise review boundaries and change detection, not the illustrative application test snippets.

## Source

- `dist/index.html`: responsive interface and architecture guidance.
- `dist/app.js`: local workspace, classification, review, import/export.
- `dist/check_intent.py`: downloadable CI change detector.
- `tests/`: review-boundary and detector tests.

A logical next step is authenticated repository-backed proposals tied to commit SHAs, GitHub review identities, and branch protection. Never treat browser-exported approval history as proof of human authorization.
