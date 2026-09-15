# Proposal — PDM Operating Model v2

**Status:** PROPOSAL — review requested; no runtime behavior changed by this document.
**Authority:** Material PDM evolution → HH review required.
**Raised:** 2026-09-15

## 1. Why this proposal exists

The first live pilot exposed an interaction failure that was not visible in the original architecture review: the PDM could correctly identify a Founder checkpoint, but the review surface was poor. A local artifact path was not useful to HH when the worker was running in a remote `tmux` session, and asking whether to open a PR added an unnecessary handoff.

The current protocol has since been corrected: the Founder Decision Brief is the primary human-readable artifact, its decision content must be shown inline in the terminal, and a remotely reachable forge link should accompany it. The PR is transport, not the decision itself.

This proposal goes one step further and defines the intended **PDM ↔ Founder interaction contract** so that future implementation does not drift back toward chat-by-chat confirmation.

## 2. Core interaction principle

PDM should consume HH's **decision bandwidth**, not HH's execution bandwidth.

PDM owns analysis, routine execution, documentation maintenance, methodology selection, delegation, durable persistence, product publication, and portfolio continuation within its authority. HH is interrupted only when the decision itself belongs to HH or an external/high-blast-radius action requires explicit approval.

The default worker behavior is therefore:

```text
observe → reason → act → persist → continue
                         ↓
                decision boundary?
                         ↓ yes
              prepare review surface
                         ↓
                  ask HH once
                         ↓
              record decision → continue
```

## 3. Founder interaction contract

### 3.1 Routine work

Do not ask HH for confirmation merely because an action is consequential to the product. If the action is inside PDM authority, execute it and persist the result.

At the end of a work stretch, provide a compact progress report only when useful. Do not turn every work unit into an approval request.

### 3.2 Founder checkpoint

When a genuine Founder decision is reached, PDM must create a Founder Decision Brief containing:

- decision ID;
- exact decision question;
- why the decision matters now;
- PDM recommendation;
- strongest evidence and source references;
- alternatives considered;
- material risks and opportunity costs;
- what changes under each option;
- unresolved uncertainty that HH should know about;
- exact response expected from HH.

The worker must surface the essential contents **inline in the terminal** and provide a remotely reachable link to the durable artifact/PR. A local filesystem path alone is never sufficient.

### 3.3 HH response

HH should be able to answer in natural language. The worker should map the response to the pending decision record rather than require a special command syntax.

Examples:

```text
「選 report generation，先不做 triage。」
「我不同意，先驗證 diagnostic accuracy。」
「照你的建議做。」
「這個先不要決定，繼續收集 evidence。」
```

The worker must distinguish:

- explicit decision;
- request for more analysis/evidence;
- request to defer;
- challenge to the recommendation;
- request to stop the worker.

Ambiguous replies should be clarified rather than silently converted into a decision.

### 3.4 After HH decides

PDM records the Founder decision as the durable source of truth, updates affected Work State / Product Context, publishes according to the existing decision-persistence protocol, and resumes the portfolio loop.

A Founder decision is not complete merely because HH typed a response in the terminal; it is complete when the durable record has been updated.

## 4. Portfolio interaction

The PDM is portfolio-level. A product waiting for HH is a local wait state.

```text
A → Founder checkpoint → WAITING_FOR_FOUNDER
                         ↓
                    continue
                         ↓
B → work
                         ↓
C → work
```

When HH later responds to A, PDM resolves A's checkpoint and re-evaluates the portfolio. It should not require restarting a product-specific session.

The worker should not repeatedly surface the same pending checkpoint on every loop iteration. The checkpoint is durable and should be surfaced again only when entering a human-interaction session, when its status materially changes, or when HH asks about it.

## 5. Organization Context

The portfolio now contains multiple real products belonging to the same organization, so the previously conditional Organization Context proposal has crossed its practical trigger.

Organization Context should represent **organization-specific facts that remain true when the product changes**, but are not universal PDM methodology.

Recommended scope:

- delivery process;
- roles and decision boundaries;
- artifact conventions;
- reporting obligations;
- systems of record;
- organization-specific regulatory / quality gates when they are process facts rather than product claims.

It must not contain:

- product strategy;
- product hypotheses;
- product-specific user evidence;
- product roadmap;
- PDM operational state;
- generic PM methodology.

Boundary test:

> Replace Product A with Product B. If the statement remains true because the same organization governs both products, it is a candidate for Organization Context. If it stops being true, it belongs to Product Context.

### 5.1 Recommended storage

Organization Context should be independently durable from PDM Core and product repositories, so changing products or switching PDM providers does not erase it.

For the current case, an organization-level repository such as `harrishhc/aetherai-organization-context` is preferable to keeping aetherAI process facts in the PDM Core repository or duplicating them across product repositories.

The repository should contain a bounded `org-context.json` and human-readable supporting source/evidence files. PDM Core's registry should point to it; PDM Core should not copy its contents.

This also leaves room for a future organization to use a different process without contaminating the aetherAI context.

### 5.2 Runtime integration

The effective context for a selected product becomes:

```text
PDM Core
   + Organization Context (if product declares one)
   + Product Context
   + Work State / Active Brief
```

Organization Context should be loaded only after product selection and only for sections needed by the current work unit. It must never be included in portfolio refresh, which remains a cheap operation over Work State + bounded decision state.

The organization resolver should mirror Product Context's safety properties: registry-based resolution, path traversal protection, bounded reads, and explicit writes only.

## 6. Organization Context governance

Organization Context is a source of organizational facts, not an authority layer above HH.

If organization context says "all sprint tickets require X" but HH explicitly decides that a product follows another process, the product's explicit organizational assignment/process configuration must determine the applicable context. Organization Context must never silently override Founder authority or product-specific governance.

Changes to Organization Context should carry provenance. A practical entry shape is:

```text
FACT / EVIDENCE
source_ref
observed_at
applies_to: organization
confidence
```

A proposed organization-wide policy change should be treated as an organizational decision and escalated according to the Authority Matrix rather than silently changing the context because PDM inferred it from one product.

## 7. PDM self-observation / evaluation

The PDM should not evaluate itself by document count or number of completed tickets. The useful signals are:

- decision quality;
- learning velocity;
- unnecessary Founder interruptions;
- repeated work after resume;
- context over-read / unnecessary tool use;
- incorrect checkpoint classification;
- evidence-to-recommendation traceability;
- portfolio starvation;
- state drift between Product Context, Work State, Active Brief, and registry.

The PDM Evolution plane can use these observations later. Product outcomes must not automatically become PDM failures; there must be a causal hypothesis before changing PDM.

## 8. Resume and handoff contract

A fresh worker should be able to resume without knowing the previous model's conversation.

Minimum resume sequence:

```text
AGENTS.md
→ portfolio state
→ selected product Active Brief / Work State
→ bounded Organization Context if applicable
→ bounded Product Context as needed
→ work
```

The previous transcript is not a prerequisite for continuity.

If the worker finds a discrepancy between a durable record and a previous conversational claim, the durable record wins unless HH explicitly corrects it.

## 9. Implementation sequence

Do not implement all of this as one architectural jump.

1. **Now:** adopt the interaction contract in governance and use the current four-product portfolio as the live test.
2. **Next:** create and validate the aetherAI Organization Context repository; migrate organization-level facts out of product-specific context where duplication exists.
3. **Then:** add registry + bounded organization resolver with tests.
4. **Then:** integrate organization context into selected-product context assembly, not portfolio refresh.
5. **Finally:** evaluate whether actual sessions show a new failure before adding further runtime machinery.

This keeps the runtime change small and gives us a real test case for the abstraction before adding more infrastructure.

## 10. Explicit non-goals

This proposal does not introduce:

- a second Work State or memory system;
- a workflow/node graph;
- weighted portfolio scoring;
- automatic model/provider routing;
- provider-specific scheduling or quota logic;
- a mandatory PR for every decision;
- automatic organizational policy changes based on product behavior.
