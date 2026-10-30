# Agent Intent: incremental intent, lineage and mutation evidence

Date: 2026-10-29

Status: product direction captured from the design discussion. This is a prose design, not an executable baseline or proof of approval for future protected source changes. Open decisions below remain open.

## Purpose

Give developers confidence to let an AI agent implement software while humans retain explicit control over required behaviour. Learn the problem domain through small iterations, agreeing each incremental change rather than trying to specify the entire product upfront.

Agent Intent must use the same approach for its own development: its accepted executable specifications guide its implementation. TypeScript is the implementation language; Gherkin is the first supported specification format.

## Product surfaces

1. An agent skill guides brainstorming, examples, refinement, implementation and review.
2. A local web workbench lets humans annotate real tests and explicitly agree exact proposed changes without agent interaction.
3. A deterministic pre-commit verifier checks protected specifications, their glue/support and approval integrity.
4. Mutation analysis challenges the tests and feeds the next refinement and review loop.

The fourth capability, abstraction navigation, implementation classification and lineage are product requirements, not claims about existing functionality.

## Goals

- Express intent at high and low abstraction levels and navigate between them.
- Keep iterations small enough to understand, review and learn from.
- Require explicit human agreement for every intent change at every level; batch related decisions within an iteration.
- Give implementation choices traceable justification in accepted intent.
- Present implementation changes for optional approval.
- Expose unrequested behaviour rather than silently treating it as an implementation choice.
- Distinguish evidence supplied by intent tests from evidence supplied only by implementation tests.

## Constraints and failure conditions

- Gherkin remains the initial test format. Proposed annotations below are not implemented syntax yet.
- Protection must cover Gherkin and the glue code that gives protected scenarios their meaning, including relevant shared support and test controls.
- An agent must not approve its own intent changes or bypass a rejected check.
- A passing suite or mutation score must not be presented as proof of complete requirements or absence of scope creep.
- A lower-level intent does not become agent-editable simply because its parent was accepted.
- A label or parent ID alone must not legitimise unrelated behaviour.
- Prototypes, draft specifications and simulated approvals must be clearly distinguished from accepted executable intent and real approval.

## Classification and change policy

| Category | Meaning | Review policy |
| --- | --- | --- |
| Intent | Behaviour explicitly required by humans, at any abstraction level | Explicit agreement for additions, edits, removal and reclassification |
| Implementation | A current mechanism or permitted choice derived from accepted intent | Initial classification and derivation require agreement; later implementation changes are presented for optional approval |
| Unrequested behaviour / scope creep | Behaviour with no agreed requirement or justified implementation role | Flag separately; remove or propose new intent rather than silently classify as implementation |

Initial classification of a mutation survivor as an implementation choice requires explicit human agreement. Reclassifying intent as implementation remains a protected intent change. Optional approval does not authorise a protected change.

Whether unresolved scope concerns block iteration completion is an open decision. Scope creep is a review finding; no third test annotation has been agreed.

## The iteration

1. **Explore:** brainstorm iteratively with a human, optionally using disposable prototypes. Identify a small learning goal and candidate examples.
2. **Specify and refine:** resolve ambiguous behaviour, propose executable intent and zoom into requirements where more detail is useful. Link refinements to their parent requirements.
3. **Agree the batch:** show exact intent changes, rationale, parent relationships, protected glue changes and new implementation classifications. The human explicitly agrees the batch or individual changes through the web interface.
4. **Implement:** observe a new behaviour's test fail, implement it and obtain a passing result. For a behaviour-preserving refactor, establish a green baseline and verify it remains green. Record implementation choices and their supporting tests.
5. **Verify and review:** deterministically check exact revision approval, protected Gherkin/glue, classifications and lineage. Present already classified implementation changes for optional approval. Flag scope concerns separately.
6. **Challenge:** run mutation analysis against intent tests, then implementation tests against the same survivors. Interpret the results and route discoveries to another small proposal and agreement batch.
7. **Learn:** use the findings to choose the next small iteration. Whether a discovery reopens the current iteration or starts the next has not been decided.

The process is iterative rather than a one-way waterfall. New intent found during implementation or mutation analysis returns to explicit agreement. Approval applies only to reviewed revisions; subsequent protected edits need fresh agreement.

## Abstraction and lineage

Intent is a review policy, independent of architectural layer or abstraction depth. A high-level outcome can refine into capability, domain and boundary intent. Refinement is optional where existing detail is sufficient. The interface must support zooming out as well as in.

Every implementation test must derive from accepted intent. The review must show the parent requirement and a rationale explaining how the implementation choice supports it. Refinements should carry explicit links to their parent intent.

### Human-readable identifiers

- The agent suggests descriptive IDs; the developer can edit them before acceptance.
- Use a domain prefix and readable phrase, such as `booking.allow-adjacent-bookings`.
- IDs are unique within a project and remain stable when scenarios move or wording changes.
- Parent relationships are explicit rather than encoded in the entire ID path.
- Renaming an accepted ID requires agreement, updates references and retains history.

Illustrative syntax:

```gherkin
@intent @id:booking.prevent-overlapping-bookings
Scenario: Reject an overlapping booking
  Given Court 1 is booked from 10:00 to 11:00
  When another booking requests 10:30 to 11:30
  Then the booking is rejected

@intent @id:booking.allow-adjacent-bookings
@derived-from:booking.prevent-overlapping-bookings
Scenario: One booking starts when another ends
  Given Court 1 is booked from 10:00 to 11:00
  When another booking requests 11:00 to 12:00
  Then the existing booking does not prevent it

@implementation @id:booking.compare-half-open-time-ranges
@derived-from:booking.allow-adjacent-bookings
Scenario: The overlap calculation excludes the end boundary
  Given two booking ranges share only an end and start boundary
  When the overlap helper compares their half-open ranges
  Then it reports no overlap
```

Implementation rationale: half-open intervals are the chosen representation for the accepted adjacency rule. Another representation is permitted if it preserves that intent. This illustrative boundary test resembles the parent intent; a test intended to distinguish implementation alternatives must also assert the actual chosen mechanism, rather than merely duplicate the intent example. The first acceptance of this classification and derivation requires agreement.

### Proposed deterministic lineage checks

These are design proposals to operationalise the agreed lineage requirement:

- Reject duplicate IDs and references to missing requirements.
- Require implementation tests to reference accepted intent.
- Reject cyclic ancestry and implementation-only ancestry that never reaches intent.
- Treat changed parent links and accepted-ID renames as reviewable lineage changes.
- Surface descendants when a referenced intent is removed or reclassified.

Whether direct links must target the most specific applicable intent, whether multiple parents are allowed and the exact annotation schema remain open.

## Mutation evidence

Mutation analysis changes implementation code and runs the tests against those controlled changes. It does not mutate accepted specifications to make them pass.

Establish passing unmutated test baselines first. Keep failing baselines, invalid mutants, timeouts and uncovered mutations distinguishable from meaningful surviving behaviour changes; their precise policies remain to be designed.

### Two passes

1. Run only intent tests, across abstraction levels, against relevant implementation mutants.
2. For the same mutants surviving pass 1, run implementation tests to determine whether documented implementation choices distinguish them.

The second pass does not improve the reported intent score. Report caught-by-intent, caught-only-by-implementation and unexplained survivors separately. A survivor is not automatically a valid implementation choice.

### Survivor review

| Finding | Response |
| --- | --- |
| Required behaviour is ambiguous or missing | Propose a more detailed intent specification, agree it and add or strengthen tests |
| Intent is clear but the test or glue does not enforce it | Repair the protected test/glue through explicit agreement |
| Several observable behaviours are acceptable under intent | Propose an implementation test documenting the current choice, its intent parent and rationale; obtain initial classification agreement |
| No observable difference has been demonstrated | Present an equivalence candidate with reasoning; do not invent a behavioural assertion just to kill it |
| No accepted requirement justifies the behaviour | Flag a scope concern |
| Evidence remains inconclusive | Keep the survivor unexplained |

Tests can document implementation choices without elevating them into required behaviour. Truly equivalent mutants may not be distinguishable by a meaningful behavioural test. An exemption/reasoning path is therefore proposed, with exact approval, expiry and revalidation rules still open.

## Web review requirements

The review for an iteration must make visible:

- The learning goal and the small change being proposed.
- Intent changes at every affected abstraction level, their exact diffs and rationale.
- Protected glue/support changes and the scope of the approval.
- Initial implementation classifications, human-readable IDs, parent intent and derivation rationale.
- Changes to previously accepted implementation choices, with optional approval actions.
- Unrequested behaviour and why it lacks an agreed justification.
- Mutation results with parent requirements and test evidence, keeping the two passes separate.

Support approval of related changes as a batch. Later protected edits invalidate approval for that changed revision. Do not claim independently authenticated human approval from the current local-only implementation.

Whether the implementation-change list includes all source diffs or focuses on behavioural choices and their tests remains open.

## Approaches considered during the discussion

| Approach | Trade-off | Direction |
| --- | --- | --- |
| Add more intent tests for every survivor | Can over-constrain valid implementation freedom | Use when required behaviour is missing or ambiguous |
| Accept reasoned equivalence exemptions only | Handles equivalent mutants but does not document meaningful current choices | Retain as a separate proposed path |
| Add implementation tests linked to intent | Documents choices while allowing later changes; needs classification review to avoid hiding scope creep | Chosen direction, alongside intent refinement and equivalence triage |

The selected lineage direction is agent-suggested, human-editable descriptive IDs with explicit parent links. The exact tag names remain illustrative.

## Current implementation boundary

The TypeScript version already has a local annotation/review API, Gherkin parsing and deterministic HEAD/index verification. Its current protection conservatively covers the whole feature file and configured glue/support pool. It does not provide fine-grained dependency discovery.

There are two distinct decisions: semantic agreement on the proposed intent before implementation, and the current verifier’s approval of the final exact staged tree. Today approval is bound to HEAD plus the entire index tree, so staging implementation changes after an earlier approval invalidates it even if protected intent is unchanged. Until a separately agreed approval model changes this, final staged-tree approval is still necessary. The concept diagrams show semantic agreement and are not a precise simulation of this existing approval scope.

This design does not silently relax that protection. Mixing implementation scenarios into a protected file or changing shared glue remains subject to current protection until a separately agreed change defines safe finer granularity.

Abstraction navigation, lineage annotations, implementation-test classification, mutation orchestration and the expanded review workflow are future capabilities. The diagrams simulate them and do not modify a repository or execute tests.

## Open decisions

1. Does unrequested behaviour block iteration completion until removed or accepted?
2. Does a mutation discovery reopen the current iteration or start the next?
3. Does optional implementation review cover all code diffs or behavioural choices and tests?
4. Must implementation tests reference the most specific intent, and can they have several parents?
5. What exact lineage syntax, rationale storage and rename-history format should be used?
6. How are equivalent-mutant exemptions approved, scoped, invalidated and reconsidered?
7. How should early semantic agreement relate to final exact-tree approval, given that the current verifier invalidates approval after any index change?
8. What mutation scope, performance budget and completion criteria apply? “Every relevant survivor has an agreed disposition” was proposed, not yet accepted.

## Design artifacts

See [artifact index](artifacts/2026-10-29-intent-dd/README.md) for the current interactive iteration flow, the earlier lifecycle exploration and their editable source fragments. The current flow is the preferred discussion aid; the earlier flow is historical.

The next product step is to resolve the remaining policy decisions and translate an agreed small slice into proposed Gherkin scenarios. Saving this document does not itself accept new executable intent or authorise implementation.
