# Mobile static approval implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task by task.

**Goal:** Review selected Gherkin changes offline on a phone and import the user's exact pasted approval batch.

**Architecture:** Build a review model from the existing snapshot and acceptance lock. Export self-contained HTML and plain text from that model; import decisions through a strict CLI validator that writes the lock once after validating the entire batch.

**Tech Stack:** Existing TypeScript, Node 24.19+, Cucumber, Node BDD tests, esbuild. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-30-mobile-static-approval-design.md` (approved in chat).

## Global constraints

- Selection starts empty and never writes acceptance.
- Bind report, accepted baseline and exact decision records. Hashes are integrity identifiers, not authentication.
- Preserve unselected definitions, test outcomes and the existing lock format.
- Never apply approvals to the development repository without the user's pasted decisions.
- Implementation stays on an isolated feature branch in the fresh task checkout. Do not push or merge.

## Review focus

- HTML containing script delimiters must remain inert escaped specification text.
- A mixed valid/invalid batch must leave lock bytes unchanged.
- Reports and accepted definitions changed after export must invalidate old approvals.
- Clipboard failures and script-disabled previews need readable selectable fallback text.
- Removed scenarios require explicit selection; failed test results must survive acceptance.

### Task 1: Approval model and deterministic import

Files: create `src/lineage/review.ts`, `tests/mobile-review.test.ts`; modify `src/lineage/state.ts`.

Interfaces: `createReview(root): StaticReview`, `importApprovals(root, text): number`, `writeAccepted(root, scenarios): void`. Review contains version, reviewId, and records with key/name/path/proposed/expectedAcceptance.

- [x] Write tests for selective batch updates/removals, malformed/duplicate/tampered/unknown/empty decisions, source/report/baseline staleness, replay and atomic failure.
- [x] Observe tests fail before implementing the exports.
- [x] Implement strict envelope validation, full source/report comparison and one atomic lock write.
- [x] Run the focused unit tests and confirm all cases pass.

### Task 2: Offline export and CLI

Files: create `src/lineage/static-review.ts`; modify `src/cli.ts`; extend unit tests; create `features/mobile_review.feature` and `features/steps/mobile-review-steps.ts`; update `cucumber.mjs`.

Interfaces: `renderStaticReview(model): { html: string; text: string }`; CLI `review --output PATH` writes PATH.html/PATH.txt; `approve --file PATH` or `approve` reads an envelope from file/stdin.

- [x] Write Gherkin examples and CLI tests for export without acceptance, selected import and stale batch rejection; observe failure with the pre-change runtime.
- [x] Render existing before/after Gherkin report with empty selection controls, selected-decision summary, copy button and visible textarea; include complete text fallback.
- [x] Keep inline script fixed and place escaped JSON in an inert data block; no external resources or network.
- [x] Build runtime and run targeted CLI tests and acceptance suite.

### Task 3: Workflow, verification and review

Files: update `README.md`, `AGENTS.md`, `.agents/skills/intent-dd/SKILL.md`, `docs/requirements/README.md`; include generated `runtime/*.cjs`.

- [x] Document mobile file review, exact envelope import, stale rejection and human authorship limitations; correct obsolete local-only approval guidance.
- [x] Run npm run build and npm test; generate this iteration's review files without accepting them.
- [x] Inspect the static interface at a narrow viewport and exercise selection and clipboard fallback if a browser test runtime is available.
- [x] Review the final diff for the five review-focus cases; address material findings and rerun affected checks.
- [x] Leave all new specification entries pending, present review artifacts and report actual test results. No automatic commit or push.

## Execution ledger

- Plan accepted for inline execution under the user's instruction to proceed; no further planning confirmation needed.
- Fresh connector-retrieved checkout is separate from earlier dirty work. Feature branch provides additional isolation.

- Task 1: complete — approval protocol tests observed missing-module failure, then passed. All approval writes in tests target temporary projects.
- Task 2: complete — pre-change CLI rejected review; export/import tests and new Gherkin scenarios pass. Delimiter-like names and CRLF regression observed failing then passing.
- Task 3: complete — npm run build, npm test and npm run test:lineage pass: 15 scenarios / 132 steps and 63 unit tests. No acceptance imported into this repository; no lock created.
- Independent review: one Important finding fixed — literal dollar sequences were interpreted by String.replace in static export. Regression observed failing then passing; callback substitution preserves exact data. Reviewer reports no remaining Critical/Important findings.
- Browser verification: Chromium at 390x844 confirmed empty selection, exact single decision, clipboard fallback selecting full text, no horizontal overflow, clear and reload resets. Screenshot inspected internally.
- Ruling: reuse the fresh isolated checkout on a dedicated mobile-static-approval branch rather than creating another worktree; earlier dirty checkout remains separate. Cost if wrong: checkout must be retained until reviewed changes are committed.
- Ruling: several per-specification text envelopes may be concatenated for one atomic batch, providing script-free selective approval without editing JSON. Cost if wrong: users must copy complete envelopes and request a fresh review after each import.
- No commits or pushes performed. Generated review files are deliverables; specification acceptance remains pending.
