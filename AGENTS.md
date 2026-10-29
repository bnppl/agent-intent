# Intent DD contributor workflow

Read `.agents/skills/intent-dd/SKILL.md` before changing behaviour or executable specifications. This is the repository developer skill, not a separately installed personal ChatGPT skill.

Develop from `features/intent_workflow.feature`. Keep intent meaning, assertions, and complete glue/support protection intact. Changes to protected source need human review; never self-approve or bypass the hook. Prepare migration changes as a review proposal rather than silently treating them as accepted intent.

Run `npm ci`, `npm run build`, and `npm test`. Commit the generated `runtime/cli.cjs` alongside its source after review. The hook runs the trusted HEAD bundle, with no package installation or candidate compilation.
