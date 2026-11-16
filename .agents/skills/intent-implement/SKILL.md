---
name: intent-implement
description: Implement an existing Gherkin specification when the user asks to build the behaviour described by a feature or scenario.
---

# Implement a specification

Follow [Agent Intent](../agent-intent/SKILL.md) for iteration, evidence and acceptance rules.

Non-functional requirements do not need Gherkin specifications or unit tests.
Enforce coding standards and REST conventions through tooling under
`npm run check:static`; do not create checker specifications or unit tests.
The implementation steps below apply to functional behaviour.

1. Read the selected Gherkin, project instructions, existing implementation and supporting specifications in the repository that owns the behaviour. Choose one observable outcome as a vertical slice across its responsible components. A small iteration does not justify flattening its specification hierarchy. Resolve materially different product or ownership decisions with the user.
2. Map the specification hierarchy before implementing. For each parent step that relies on another responsibility, identify the owning component, its existing or proposed contract and evidence at that component's boundary. Recursively follow supporting contracts to meaningful leaf responsibilities, including focused unit specifications. Reuse existing specifications; draft missing contracts as proposals within the authorised outcome. Record which branches are existing, new, unaffected, not applicable or deferred, with reasons. Do not silently defer necessary contracts or change responsibility ownership to avoid them.
3. Add linked behaviour tests at the applicable boundaries, covering the examples and meaningful failures. Keep the parent journey's own end-to-end test independent of its supporting tests. Observe the intended failure before implementing each changed behaviour. Record actions, results and assertion values in the executing step; capture failure evidence before asserting and redact secrets.
4. Implement the smallest complete change that satisfies those contracts. Preserve specification meaning and report proposed changes separately. Do not invent frontend, backend or persistence work merely to fill a fixed set of layers. A browser-local draft may have no backend selection contract; document that decision and reuse applicable catalogue contracts.
5. Connect tests and lineage using the [report workflow](../agent-intent/references/project-workflow.md). Give each supporting scenario its own lineage ID and `@component:<name>` identity. Link it to the owning step with `@supports:<parent-lineage-id>:<step-number>`. Count steps in displayed order, including feature and rule backgrounds. For leaf unit specifications, use their own BDD descriptions and the Node test tags `supports:<parent-lineage-id>:<step-number>` and `component:<name>`. Sharing only the journey's lineage ID does not establish a step-level relationship.
6. Run `npm run check:static`, focused tests, regression checks and fresh lineage. Review both behaviour and hierarchy: expand parent steps through their component contracts and leaf evidence, including every changed outline example and relevant failure path. Check that support links resolve to the intended steps and results remain independent at each level. Complete missing instrumentation and report missing, unexecuted or deferred branches explicitly. Passing end-to-end and unit suites alone do not establish complete fractal coverage. Present the hierarchy, actual results, remaining gaps and pending human acceptance at the review checkpoint; do not claim the outcome complete while necessary contracts or evidence are missing.
