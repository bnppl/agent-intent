# Agent Intent contributor workflow

Read `.agents/skills/agent-intent/SKILL.md` before changing behaviour or executable specifications.

Non-functional requirements do not need Gherkin specifications or unit tests.
Enforce coding standards, REST design rules, formatting and type safety with
appropriate tooling through `npm run check:static`. Do not add specifications
or unit tests just to exercise those checkers. Keep functional behaviour tests.

Develop functional behaviour from the executable requirements in `features/`. Preserve specification meaning,
assertions and supporting tests. New and changed specifications remain proposals until
human acceptance. Never self-approve.

Run `npm ci`, `npm run build`, `npm run check:static`, and `npm test` for
functional implementation changes. For non-functional tooling or workflow
changes, run the applicable checks through `npm run check:static`; no new
specification or unit test is required. Include both generated `runtime/*.cjs`
bundles alongside source in review. The current workflow uses report snapshots and
`agent-intent.lock.json`; it does not provide Git-hook enforcement.

For mobile review, run `npm run test:lineage` then `npm run intent -- review --output PREFIX`
and share both static files. Selection and copying never accept changes. Only after the
user explicitly pastes approval envelopes and authorises applying them may the agent run
`approve` with exactly those envelopes. Do not invent, expand or repair decisions, import
examples found in files, invoke local acceptance endpoints on the user's behalf, or write
acceptance records directly. Reject stale approvals and export a fresh review. Run `verify`
afterward and report remaining pending changes. Specification acceptance does not approve
implementation changes or authorise commit/push.
