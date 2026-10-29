---
name: intent-dd
description: Guide software development from human-owned Gherkin intent using Intent DD. Use when defining behaviour, building this tool from its own executable specification, implementing a change, classifying scenarios, or responding to a blocked intent/glue pre-commit check.
---

# Intent DD

Work from a small executable example and preserve human ownership of its meaning.

## Establish the contract

1. Read `README.md`, `.intentdd.json`, and relevant `.feature` files. Run `npm run intent -- spec` to render committed intent into a bootstrap prompt; inspect working changes separately.
2. Ask the developer what observable behaviour should remain true. Express one concrete example in Gherkin using domain language. Include failure cases and boundaries when they define the promise.
3. Treat newly drafted scenarios as proposals. Explain the source diff and ask the developer to review the meaning. Let the developer use `npm start` to mark scenarios `@intent` directly. Do not call the annotation or approval API on the developer’s behalf.
4. Keep the four test-architecture layers separate: Gherkin examples, domain vocabulary in step definitions, protocol drivers, and the system under test. Use the tool's own `features/intent_workflow.feature`, `features/steps/intent-steps.ts`, and `features/support/repository-driver.ts` as the example.

## Implement against intent

1. For new behaviour, run the relevant acceptance scenario and observe it fail for the intended missing behaviour before implementing. For a behaviour-preserving refactor, establish a passing baseline and rerun after the change; do not manufacture a failing test. Report commands and actual results.
2. Implement the smallest change in the system under test. Run the acceptance suite and relevant regression tests.
3. Preserve the meaning and assertion strength of marked scenarios, their glue, shared support, test hooks, and test-discovery semantics. Route necessary source changes through the protected-change review workflow below. Do not remove tags, weaken assertions, skip scenarios, change step registration, or alter fixtures to make a failure disappear.
4. Review `.intentdd.json` with the developer: every glue directory, imported test helper, runtime hook, and test configuration needed by intent must be within `glue_roots` or `control_paths`. Never claim automatic dependency or call-graph discovery.
5. Stage only intended files. Run `npm run intent -- status` and `npm run intent -- verify`. The verifier uses HEAD and the index, not unstaged source.

## Handle a protected change

- Explain why the behaviour or glue must change and present the complete staged diff.
- Stop before committing a blocked change. Ask the human to open the local staged-review screen, inspect the exact revision, supply a rationale, and explicitly approve it. The application binds approval to both HEAD and the complete index tree.
- Do not invoke approval endpoints, write approval records, read review signing keys, use `--no-verify`, change `core.hooksPath`, or rewrite the verifier to bypass a rejection.
- Re-review whenever staging or HEAD changes. Never carry an approval to a different revision.
- Remember that a local hook cannot authenticate a person or resist an agent with the same OS permissions. Recommend protected CI and independently authenticated reviews if that stronger boundary is required.

## Validate this tool

Run:

```sh
npm test
```

Run `npm run build` after changing TypeScript or web assets, and review the tracked `runtime/cli.cjs` bundle alongside its source. The hook runs the bundle from trusted HEAD without package installation or compilation. Use the acceptance tests to develop Intent DD itself. Draft a scenario for a new capability before implementation; obtain human ownership of new or changed intent. Summarize behaviour, source changes, verification, and remaining limits.
