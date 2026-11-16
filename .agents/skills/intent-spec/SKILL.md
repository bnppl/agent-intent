---
name: intent-spec
description: Draft reviewable Gherkin scenarios for one high-level requirement in intent.md. Use when a project brief is ready and the user asks to specify its first or next requirement.
---

# Draft Gherkin from project intent

Non-functional requirements do not need Gherkin specifications or unit tests.
For coding standards, REST enforcement, formatting or type checks, update the
relevant guidance and tooling, include checks in `npm run check:static`, and
report the actual check results. Use the steps below for functional requirements.

1. Read the project's `intent.md`, `AGENTS.md`, Agent Intent configuration and relevant feature files. Use the requirement the user selected. For “first requirement,” use the first bullet under **High-level requirements**. Use the problem statement to interpret the requirement and keep the proposal within its scope.
2. Name one observable outcome, the evidence that would demonstrate it and the review checkpoint. Choose a slice the user can review on its own. Ask only if resolving an ambiguity would commit the user to materially different behaviour.
3. Draft or extend a `.feature` in a configured feature root. Include the source requirement in the feature or rule description so the reader can trace the examples to the brief. Describe concrete context, user action and observable result in domain language. Include a meaningful boundary or failure case when the brief implies one. Leave undecided product rules as review questions.
4. Create or update `.agent-intent.json` alongside the proposal. Keep `version: 1` and ensure `feature_roots` covers the proposed feature file. Preserve existing roots and other configuration. Inspect the project's actual scripts and test runners. Configure `checks` as executable/argument arrays using the aggregate `check:static` command when available and existing build and test commands, including an existing command that generates fresh lineage. Preserve established check ordering and avoid duplicate commands. In a project with an existing workflow-reporting test script, use that script so `start` can run it. For a project awaiting its first tests, use the requirements-only report workflow and explain that background `start` needs a real reporting check once tests exist.
5. Run the project's Agent Intent `spec` command to validate the configuration and parse the proposal. When reporting checks are available, run Agent Intent `run` to verify those checks produce fresh evidence. Follow the [report workflow](../agent-intent/references/project-workflow.md) to show the proposed scenarios as **Not run** until supporting application tests execute. Preserve existing test evidence and distinguish other pending scenarios from this proposal.
6. Share the scenarios, configuration changes, actual check results, planned evidence and any decisions for review. Drafting Gherkin includes the Agent Intent configuration needed to discover and review it. Application implementation and specification acceptance each need their own user-authorised scope.

Use the [Agent Intent skill](../agent-intent/SKILL.md) for iteration and acceptance rules.
