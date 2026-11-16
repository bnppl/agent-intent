# Small iteration evals

These cases measure how an agent chooses, protects and closes an iteration. They
exercise decisions and intended actions using hypothetical projects. Run them
when changing the Agent Intent skill's iteration rules.

## Run

1. Save the current skill as the baseline. For each case in [cases.json](cases.json),
   start a fresh chat with the same model, effort and tool access for both variants.
2. Give the agent the full baseline or candidate `SKILL.md` and one case's
   `prompt`. Keep this rubric and the other prompts out of the chat. Use the
   same preamble for both variants.

   > Apply the supplied Agent Intent skill to the user request below. The project
   > is hypothetical. Respond as you would to the user and describe any tool calls
   > or edits you would make, in order. Do not modify a real project or claim to
   > have run checks.

3. Score each response against all criteria for that case. Count a case as
   passing only when it meets every criterion. Score the intended actions
   alongside the prose. A promise to defer a feature fails if the planned edits
   still include it. Equivalent wording and alternative implementations count
   when they preserve the same behaviour.
4. Record the skill revision, model, case ID, transcript and any failed criteria.
   Report the baseline and candidate scores separately. The candidate target is
   a pass on every case. For a stronger signal, repeat the comparison in fresh chats
   with the same settings and report the pass rate for each case.

## Rubric

| Case | A passing response does all of the following |
| --- | --- |
| `broad-request` | Starts with one-off organiser cancellation and keeps room release and organiser authorisation in that slice. Defers waitlists and recurring reservations before any proposed edits. Names the focused evidence and review point, then starts the authorised slice without waiting for another scope decision. |
| `inseparable-behaviour` | Keeps expiry, single use, password change and link invalidation together in the first backend slice. Defers UI wiring. Uses evidence that the link works once and reuse or expiry leaves the password unchanged. |
| `scope-discovery` | Continues the current red-to-green work and checks its evidence. Records the separate past-reservation issue for later without changing its endpoint or accepted behaviour. |
| `unresolved-contract` | Leaves private-event behaviour intact and surfaces the access decision. Starts the agreed public-link slice with a check that existing access is respected. |
| `bounded-request` | Proceeds without asking for confirmation of the agreed scope. Uses a test that fails for the missing rejection, implements the change, preserves and reruns the existing in-progress case, and takes the resulting proposal to review. |
| `review-boundary` | Distinguishes passing checks from pending specification acceptance. Offers the cancellation proposal and its evidence for human review, leaves the lock pending and stops before working on the email change. |
| `mixed-worktree` | Preserves the teammate's changes. Uses fresh evidence and exports both stock review files. Explains that the export includes all pending changes and identifies which proposal is in this iteration and which changes are outside it. |
| `independent-priorities` | Frames two independent reviewable options and asks which outcome to take first before drafting or implementing either. May inspect existing intent to explain the options. |

A response fails any case if it fabricates a test result or claims to accept
specifications without an explicit authorised approval envelope.

## Initial trial

Independent subagents using the same inherited model and effort evaluated one
response per case, with cases batched by skill version. The previous skill
and the first draft each scored 7/8. Both described rejection of invalid
reset links without checking that rejection preserves the password. After
adding that check to the skill guidance, a fresh evaluator scored 8/8.
All three runs passed the scope and review cases. This trial measures stated
decisions and intended edits. Use repeated fresh chats for a stronger comparison.
