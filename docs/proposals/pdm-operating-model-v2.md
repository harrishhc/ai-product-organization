# Proposal — PDM Operating Model v2

**Status:** PARTIALLY ADOPTED — see §2. Kept as the historical proposal record; `governance/COLLABORATION_PROTOCOL.md` and `governance/AUTONOMY_BOUNDARY.md` are the live specification, not this document.
**Authority:** Material PDM evolution → HH review required.
**Raised:** 2026-09-15
**Revised:** 2026-09-16 — trimmed after review found ~2/3 of this document restating content already in the two governance files above. See the review note in §2.

## 1. Why this proposal exists

The first live pilot exposed an interaction failure that was not visible in the original architecture review: the PDM could correctly identify a Founder checkpoint, but the review surface was poor. A local artifact path was not useful to HH when the worker was running in a remote `tmux` session, and asking whether to open a PR added an unnecessary handoff.

The current protocol has since been corrected: the Founder Decision Brief is the primary human-readable artifact, its decision content must be shown inline in the terminal, and a remotely reachable forge link should accompany it. The PR is transport, not the decision itself.

This proposal's original draft went further and tried to define the full PDM ↔ Founder interaction contract in a new document. A review before merge found that most of that contract already existed in two other governance files, and that standing up a third document describing the same interaction contract was the exact single-source-of-truth drift this repo's own philosophy warns against. §2 records what actually happened as a result.

## 2. Disposition of the original sections

| Original section | What it proposed | Disposition |
|---|---|---|
| §2 Core interaction principle | PDM consumes decision bandwidth, not execution bandwidth | Already the substance of `governance/AUTONOMY_BOUNDARY.md` in full. Not duplicated here. |
| §3.1 Routine work | Don't ask for confirmation merely because an action is consequential | Already `AUTONOMY_BOUNDARY.md` §1's opening rule. Not duplicated here. |
| §3.2 Founder checkpoint (brief contents, inline + link) | Brief must contain decision/recommendation/evidence/alternatives/risks; must surface inline + remote link | Already `COLLABORATION_PROTOCOL.md`'s "Founder checkpoints" section and `AUTONOMY_BOUNDARY.md` §4, near word-for-word. Not duplicated here. |
| **§3.3 HH's response (new)** | Response taxonomy: decision / more evidence / defer / challenge / stop; classify before recording | **Genuinely new. Merged into `COLLABORATION_PROTOCOL.md`, "Founder checkpoints" section, subsection "HH's response."** |
| §3.4 After HH decides | Record decision, update state, publish, resume loop | Already the decision-persistence protocol in `WORK_STATE_BOUNDARY.md` + `COLLABORATION_PROTOCOL.md`'s human-flow diagram. Not duplicated here. |
| §4 Portfolio interaction (waiting is local) | A→checkpoint→WAITING; continue on B, C | Already `COLLABORATION_PROTOCOL.md`'s operating model and `AUTONOMY_BOUNDARY.md` §2. Not duplicated here. |
| **§4 "don't repeatedly surface" (new)** | Don't re-present the same pending checkpoint every loop pass | **Genuinely new. Merged into `COLLABORATION_PROTOCOL.md`, "Founder checkpoints" section, subsection "Don't re-raise a checkpoint every loop pass."** |
| §5–§6 Organization Context | Full proposal for an Organization Context layer | Duplicated `docs/proposals/organization-context-layer.md`, the dedicated proposal for this exact topic, in less detail. Removed from here; that document is authoritative. |
| **§8 Resume/handoff conflict rule (new)** | Durable record outranks a prior conversation's unpersisted claim | **Genuinely new. Merged into `COLLABORATION_PROTOCOL.md`, "Cross-provider handoff" section.** |

Only §7 (below) and §9's first step remain here as live proposal content; everything else in the original draft is superseded by the merges above and has been removed from this document rather than kept as a second copy. (Section numbers below skip 3–6 and 8 deliberately — they preserve the original draft's numbering for traceability against the table above, rather than renumbering after deletion.)

## 7. PDM self-observation / evaluation

**Status: aspirational goals, not yet instrumented — except where marked.** `runtime/instrumentation.js` currently measures context-load volume and tool-call count (labelled below); nothing else in this list has a defined measurement mechanism anywhere in the runtime today. Listing them together previously made the unmeasured majority look as concrete as the measured minority — that was the reviewer's third finding on this PR.

**Measurable today** (`runtime/instrumentation.js`):
- context over-read / unnecessary tool use (`contextSectionsLoaded`, `toolCalls`, `estimatedTokens`)

**Aspirational — no instrumentation exists yet:**
- decision quality
- learning velocity
- unnecessary Founder interruptions
- repeated work after resume
- incorrect checkpoint classification
- evidence-to-recommendation traceability
- portfolio starvation
- state drift between Product Context, Work State, Active Brief, and registry

The PDM Evolution plane can use these once instrumented. Product outcomes must not automatically become PDM failures; there must be a causal hypothesis before changing PDM. Building measurement for the aspirational list is future work, not proposed by this document — a separate proposal should scope which signal to instrument first and why, rather than instrumenting all eight at once.

## 9. Implementation sequence

1. **Done:** the genuinely new interaction-contract content (§2's three merged items) is adopted directly into `governance/COLLABORATION_PROTOCOL.md`.
2. Organization Context implementation follows `docs/proposals/organization-context-layer.md`'s own sequence, not a second one defined here.
3. Instrumenting any §7 aspirational signal is future work requiring its own proposal.

## 10. Explicit non-goals

This proposal does not introduce:

- a second Work State or memory system;
- a workflow/node graph;
- weighted portfolio scoring;
- automatic model/provider routing;
- provider-specific scheduling or quota logic;
- a mandatory PR for every decision;
- automatic organizational policy changes based on product behavior.
