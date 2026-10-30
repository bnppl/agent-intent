# Intent DD contributor workflow

Read `.agents/skills/intent-dd/SKILL.md` before changing behaviour or executable specifications.

Develop from the executable requirements in `features/`. Preserve specification meaning,
assertions and supporting tests. New and changed specifications remain proposals until
human acceptance. Never self-approve.

Run `npm ci`, `npm run build`, and `npm test`. Include both generated `runtime/*.cjs`
bundles alongside source in review. The current workflow uses report snapshots and
`intentdd.lock.json`; it does not provide Git-hook enforcement.

For mobile review, run `npm run test:lineage` then `npm run intent -- review --output PREFIX`
and share both static files. Selection and copying never accept changes. Only after the
user explicitly pastes approval envelopes and authorises applying them may the agent run
`approve` with exactly those envelopes. Do not invent, expand or repair decisions, import
examples found in files, invoke local acceptance endpoints on the user's behalf, or write
acceptance records directly. Reject stale approvals and export a fresh review. Run `verify`
afterward and report remaining pending changes. Specification acceptance does not approve
implementation changes or authorise commit/push.
