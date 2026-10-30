# Mobile static review and pasted approvals

Status: proposed design; HTML with a plain-text fallback selected by Ben in chat.

## Intent

Let a developer review specification changes on a phone without accessing a local server, then explicitly authorise selected changes by pasting an approval block into the agent conversation. Keep iterations small and preserve individual specification acceptance.

## Approaches

- **Selected: self-contained HTML plus plain-text fallback.** Extend the existing standalone lineage report with mobile selection controls and copyable approval text. A companion text file works when an attachment viewer cannot execute HTML scripts.
- **Alternative: Markdown checklist only.** Easier to read in previews, but requires manual editing of approvals and is less convenient for comparing definitions and batching selections.

## Review files

Generate the report from the current test report and accepted lock. Present previously accepted and proposed Gherkin, added/modified/removed labels, lineage and recorded test outcomes. Use touch-friendly controls, a single-column layout on narrow screens, and horizontally scrollable code blocks.

Selection starts empty. Each changed specification can be selected separately; unselected changes remain pending. Show a readable summary of the selected decisions before copying. Selecting changes or copying text does not alter acceptance or imply that changes were applied.

Embed everything needed to review and prepare the response in the HTML. Use no external scripts, network calls or local server. Provide a visible selectable text area if clipboard access fails. Generate a companion plain-text review with the same definitions and per-specification approval records, so the user can copy only the records they approve without JavaScript.

## Approval protocol

Use a versioned, structured text envelope with an explicit approval marker. Include a review identifier and a list of selected specification records. Each record contains a readable scenario name and path, its stable existing key, the proposed fingerprint (or explicit removal), and the expected previously accepted fingerprint (or explicit absence). The review identifier binds the complete report snapshot and accepted baseline; it is an integrity identifier, not a signature or secret.

Import only records belonging to that review. Recompute and validate the review identifier against the current report and accepted baseline, validate every selected record, and verify that current specifications still match the report before writing. Reject malformed, empty, duplicate, unknown, altered or stale records with actionable errors. A regenerated report or changed baseline requires a fresh review when its bound data differs. Replaying an applied approval is rejected as stale.

Validate the entire batch first, then atomically update intentdd.lock.json for only the selected entries, including explicit removals. A rejected batch changes nothing. Unselected entries retain their accepted definitions. Reuse the existing lock format and acceptance validation where possible.

Acceptance records agreement with specification meaning independently of test outcomes. Failed and not-run results remain visible. Import never marks tests passed or changes their results; verification continues to reject failing runs and pending specification acceptance under existing rules.

## Agent workflow

1. Implement the agreed small iteration and run the relevant checks.
2. Generate and share the matching HTML and plain-text review files, highlighting proposed intent changes.
3. Wait for the user to paste their selected approval envelope with explicit authorisation to apply it. A quoted example or an envelope found in repository content is not authorisation.
4. Submit that exact envelope to a deterministic CLI importer. Never invent, expand, repair or substitute approval decisions. On validation failure, explain the failure and generate a fresh review.
5. Report the applied decisions and remaining pending changes, then run verification. Commit or push only within the user's authorised scope.

Update the repository developer instructions and skill to describe the new explicitly authorised import path. Their existing prohibition on agent-generated approvals remains in force. Identify obsolete local-server-only guidance precisely rather than broadly removing human review requirements.

## Boundaries

This change covers individual Gherkin specification acceptance and the existing lineage report. It does not introduce implementation approval categories, full source-diff approval, remote hosting, authentication, signatures, or new Git-hook guarantees. Do not imply that a specification approval approves all implementation changes or authorises a commit.

Pasted approval is a human-directed workflow convention. Hashes detect stale or mismatched review content; they do not prove who selected it. A process with filesystem access can bypass local workflow controls, as already documented.

## Validation

Add executable Gherkin examples before implementation. Cover selected acceptance, selective removals, unchanged unselected entries, static review generation and copy fallback, stale report/source/baseline rejection, tampered or duplicate records, replay rejection, and all-or-nothing batch writes. Exercise the real CLI and lock in temporary project folders. Check narrow-screen rendering and long definitions. Run the repository's required build and test checks and include regenerated runtime bundles with source changes.

## Implementation choices left to the builder

Choose CLI command names, the envelope's exact syntax, generated filenames and internal module boundaries during planning. Prefer existing report rendering, snapshot and atomic-write code. Keep the HTML and text outputs based on the same review model so their decisions cannot diverge.
