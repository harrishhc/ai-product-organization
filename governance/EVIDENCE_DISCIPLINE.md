# Evidence & Decision Discipline

See [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) §9 for full context.

PDM should maintain explicit distinctions among **FACT**, **EVIDENCE**, **ASSUMPTION**, **HYPOTHESIS**, and **DECISION**. Confidence should be calibrated to evidence strength. Founder intuition is legitimate input but is not automatically evidence.

## Evidence Strength Ladder

Encoded in [`runtime/pdmCore.js`](../runtime/pdmCore.js) as `EVIDENCE_LADDER`.

| Level | Signal | Typical confidence |
|---|---|---|
| 0 | Opinion / preference | Very low |
| 1 | Single anecdote or isolated report | Low |
| 2 | Observed behavior / usability evidence | Low–medium |
| 3 | Repeated behavioral evidence across observations | Medium |
| 4 | Quantitative evidence / experiment result | Medium–high |
| 5 | Strong causal evidence / controlled test | High |

Opinion is not evidence. Anecdote can be evidence but should be labeled as weak evidence. The PDM must not turn repeated assumptions into facts simply because they appear in older documents.

## Check Product Context before any judgment that touches a ticket or spec

This applies beyond formally writing a PRD (`governance/WORK_STATE_BOUNDARY.md`'s "PRD is subordinate to Product Context" rule) — it applies to any product judgment made in conversation that will end up changing a ticket, an acceptance criterion, or a spec, however small the ask feels. Before answering, check `context.json` for existing evidence/decisions on the topic. Conversational memory of "a document I read earlier" is not a substitute — it can be wrong, stale, or about a different question than the one actually recorded.

**Why this matters more than it looks like it should:** a judgment that skips this check doesn't just risk being *unsupported* — it can be *actively wrong* against evidence that was already sitting in the repo. On 2026-09-18, asked to judge whether a Usage Log ticket's three tracked interactions should collapse to one, the answer was reasoned from a half-remembered, only tangentially related Google Doc instead of checking `context.json` — which already had the actual authoritative answer (an IFU clause mapped to a specific regulatory audit requirement) recorded from three days earlier. The proposed simplification would have directly violated it. It was caught before reaching ClickUp only because the person asking happened to ask "did you actually use the repo's process for that."

**How to apply:** Before giving a product judgment that will change a real artifact — not only before writing a formal PRD or Founder Decision Brief — search `context.json`'s `evidence`/`decisions` for the topic first. If reasoning from an external document (a Google Doc, an old conversation, a file read earlier in the session), re-verify it's the *actually relevant* one and check whether its conclusions are already captured (possibly more precisely, or since superseded) in Product Context. When the judgment is non-trivial enough to be worth stating a rationale for, that rationale and its sources belong in `context.json` afterward, not only in the conversation — otherwise the next session repeats the same ungrounded judgment with no way to know it already happened.

## Known Source Limitations (negative evidence is only as good as the query)

A source returning "nothing found" is not the same as "nothing exists." Before recording an absence as a gap (`status: "gap_detected"` or similar), confirm the query method can actually see everything it claims to have checked.

**ClickUp: list-scoped queries silently exclude "Tasks in Multiple Lists."** ClickUp's `GET /list/{list_id}/task` endpoint returns only tasks whose *home list* is that list. A task added to a list via ClickUp's "Tasks in Multiple Lists" feature — visible in the ClickUp UI when browsing that list — is **not** returned unless the request passes `include_timl=true` ([ClickUp API docs](https://developer.clickup.com/reference/gettasks); confirmed via [ClickUp's own public tracker](https://feedback.clickup.com/public-api/p/get-tasks-parameter-to-retrieve-linked-tasks)). The ClickUp MCP tool available in this environment does not expose `include_timl`, so any "list X has no Y" conclusion drawn from a list-scoped query has a structural blind spot, not just a chance of human error.

**How to apply:** Never conclude "ticket/work doesn't exist in list L" from a list query alone. Before recording it as a gap, either look up the specific task directly (its `list` field always reflects its *current* home list, regardless of other memberships) or search by keyword across the workspace. If a "gap" evidence entry turns out to be a query-method miss rather than a real gap, correct the entry and note the mechanism, not just the wrong conclusion — see `ocr-slide-label-reader`'s `context.json` (2026-09-15) for a worked example: a ticket titled `[OCR]...` was reported "missing" from Sprint 15 while it was in fact visible in that Sprint from the ClickUp side (via multiple-list membership) prior to a home-list change confirming it — the list-scoped query never returned it.
