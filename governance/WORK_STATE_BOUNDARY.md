# Work State & Active Brief Boundary

See [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) §6 for the Product Context boundary this extends.

## Three layers, three different jobs

- **Product Context** (`runtime/context.js`) — what is true about the product: strategy, users, evidence, decisions, experiments, roadmap. Authoritative. A statement only belongs here once it is classified `FACT`, `EVIDENCE`, `ASSUMPTION`, `HYPOTHESIS`, or `DECISION`.
- **Work State** (`runtime/workState.js`) — what PDM is doing: current focus, dominant uncertainty, in-progress work, next actions, blockers, open questions, and a pointer back to the last session. Operational memory, not product truth.
- **Active Brief** (`active-brief.md`, rendered by `renderActiveBrief()`) — a small, disposable bootstrap document generated from Work State + the Product Context sections the caller already retrieved. Read at session start so PDM does not have to re-derive "where were we" from scratch every time.

## Work State is not a second source of truth

Work State must never assert a product fact or decision on its own authority. If `work-state.json` implies a decision was made, that decision must already exist in `context.json`'s `decisions` array — Work State may only carry a *reference* (id/index) to it via `last_session.decision_refs`, never a restated summary of what was decided. If a decision is referenced but not found in Product Context, treat it as not yet decided, not as an error in Product Context.

This mirrors the existing rule in `runtime/decision.js`: `recommendation` and `founder_decision` are kept as permanently distinct fields, never merged, even under override. Work State vs. Product Context is the same discipline one layer up.

## Active Brief is derived output, never hand-edited

Same treatment as the methodology registry (`ARCHITECTURE.md` §14: "derived metadata, not a second source of truth"). `active-brief.md` is produced only by `renderActiveBrief()` from the current Work State and Product Context — it is regenerated, not authored. If something needs to change in the brief, change Work State or Product Context and re-render; do not hand-edit the brief directly. A Founder note meant to steer the next session belongs in Work State (e.g. as a `next_actions` entry or an explicit field), not scrawled into the brief.

## Session protocol

**Session start:** read `active-brief.md` first. Only fall back to `context.json` (bounded, by section) or `knowledge/` (by specific source) when the brief is insufficient for the current question. Do not re-read the full product history at the start of every session.

**Session close:** before ending, update `work-state.json` via `writeWorkState()` (current focus, next actions, what got done, what's blocked, what's still open), then regenerate `active-brief.md` via `renderActiveBrief()` + `writeActiveBrief()`. Any new product fact, evidence, or decision surfaced during the session goes into `context.json` via `writeProductContext()` — separately, with the right classification — not folded into Work State.

## What updates which file

| Happened during a session | Goes into |
|---|---|
| A new product fact, piece of evidence, hypothesis, or decision | `context.json` (Product Context), correctly classified |
| PDM's own progress, next step, or an open question about *how to proceed* | `work-state.json` (Work State) |
| Neither of the above — just a readable snapshot for next time | `active-brief.md`, regenerated from the two files above |

## Decision persistence protocol (git_remote products)

The session boundary is not a reliable durability boundary — a conversation can end without an orderly close. Local writes (`writeProductContext`, `writeWorkState`, `writeActiveBrief`) only touch the product's local clone (`runtime/productSync.js#syncGitRemoteProduct`); nothing durable happens until that clone is pushed to the product's real remote (`runtime/productSync.js#publishProductRepositoryChanges`).

**Publish immediately after every `recordFounderDecision` — and only then.** Work State updates and evidence/hypothesis-only Product Context writes stay local; they are not worth the cost of an immediate push on their own. They ride along automatically the next time a real decision triggers a publish (or at session close), because `publishProductRepositoryChanges` commits whatever is currently in the clone, not just the decision.

**Reuse one branch per session**, not one branch per decision — `publishProductRepositoryChanges` reuses `branchName` if it already exists locally, so calling it once per decision with the same `branchName` accumulates commits on a single branch instead of spawning a branch/PR per decision. Suggested naming: `pdm/<product>/<session-start-date>`.

**On publish failure, retry only the publish — never redo the write.** `writeProductContext` already succeeded locally (it's a synchronous file write; it does not fail the way a network push can), so the decision is not lost. Treat a failed `publishProductRepositoryChanges` call as retryable on its own.

**Opening a pull request stays a separate, deliberate step** at the true end of a session (or whenever HH wants a checkpoint reviewed) — not automatic, and not per decision.
