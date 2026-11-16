# Separate decision inbox iteration

Observable outcome: reviewers classify scoped implementation choices in a separate
inbox grouped by journey/component, without accepting specifications or hiding
unresolved choices. Proposed contract: `features/decision_inbox.feature`.

## Responsibility hierarchy and evidence

- Review journey: new real-browser tests through the bundled CLI, loopback server,
  report navigation and form submission. The parent result is independent of leaves.
- Report and HTTP boundary: new inbox renderer and classification resource, reusing
  existing session-token, same-origin and request-size guards. Browser tests cover
  persisted classification and stale rejection with unchanged state.
- Decision store: new merge/import and classification contracts. Focused leaf tests
  linked to parent steps cover required rationale/scope, unknown IDs, atomic batch
  rejection and evidence-bound decisions. Human classifications cannot be imported
  through proposal input. These are implementation decisions, not spec acceptance.
- Mutation adapter: new shared-format import contract with independent leaf evidence
  for validation before writes and excluding tool-error outcomes. Browser evidence
  checks survivor presentation, identical re-import and changed evidence re-review.
- Specification acceptance: existing; unaffected. No acceptance records are changed.
- Engine execution, automatic test-to-requirement mapping, equivalent-mutant triage,
  offline decision import, expiry, and mandatory iteration gates: deferred. They are
  separate outcomes and are not prerequisites to the option-2 inbox.

Human review checkpoint: inspect the proposed Gherkin, browser evidence and the new
Decisions view. Review classifications separately from contract acceptance. No sample
choices are classified in the real Agent Intent or Toybox projects.
