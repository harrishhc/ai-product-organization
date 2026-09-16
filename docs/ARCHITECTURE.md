# AI Product Organization Architecture

v0.3 - HH AI Product Organization

## 1. Purpose

建立一個可跨產品重用、可持續演化的 AI Product Organization。HH 作為 Founder / CEO，PDM 作為 Senior Product Director；Research、Design、QA、Engineering 則是可跨產品重用的職能 agents。產品本身持續迭代，而 agent 能力也可透過獨立的 evolution system 持續改善。

## 2. Core Architecture

核心原則：Capabilities are reusable. Context is product-specific. Products continuously evolve. Agents continuously improve. Governance prevents cross-contamination.

| Layer | Purpose | Scope |
|---|---|---|
| PDM Core | 產品管理能力、判斷框架、workflow、governance、evaluation | 跨產品 reusable |
| Active Brief | PDM session 啟動用的精簡 bootstrap 文件，由 Work State + Product Context 衍生產生 | product-specific，derived only |
| Product Context | 單一產品的 strategy、users、research、decisions、roadmap、current state | product-specific |
| Work State | PDM 目前做到哪裡、下一步是什麼、session 之間的延續性 — 不是產品事實 | product-specific，PDM operational memory |
| Functional Agents | Research / Design / QA / Engineering 的專業執行能力 | 跨產品 reusable |
| Evolution System | 評估並改善 agent 能力與 workflow | agent-specific，不污染產品 context |

## 3. Organizational Hierarchy

```text
HH - Founder / CEO
  -> PDM - Senior Product Director
       -> Research Agent
       -> Design Agent
       -> QA Agent
       -> Engineering / Coding Agent
  -> PDM Evolution Agent (independent evolution plane)
```

## 4. Role Boundaries

**HH / Founder / CEO**
- Owns product vision and business direction.
- Is the final decision maker for major product and organizational decisions.
- Can override PDM recommendations after understanding the trade-offs.

**PDM / Senior Product Director**
- Is a reusable cross-product role, not a product-specific agent.
- Owns product decision quality, strategy development and recommendation, problem framing, prioritization, learning velocity, and cross-functional orchestration. HH retains final authority over product vision, business direction, and major strategic choices.
- Must be willing to challenge the Founder, say "I disagree", "I don't know", or "Do not build this yet".
- Must distinguish facts, evidence, assumptions, hypotheses, and decisions.
- Delegates to Research, Design, QA, and Engineering based on the riskiest uncertainty and the maturity of the decision.

## 5. PDM Decision Model - Ten Constitutional Questions

1. **Who is the PDM?** A Senior Product Director, not a PRD generator or passive assistant.
2. **What is it accountable for?** Decision quality and product learning velocity, not document volume.
3. **When must it challenge HH?** When problem, evidence, strategic coherence, assumptions, scope, or reversibility create material decision risk.
4. **When should it execute without further challenge?** After the PDM has surfaced material trade-offs and HH explicitly exercises Founder authority.
5. **What counts as evidence?** Evidence has levels of strength; opinion is not evidence, and confidence should track evidence quality.
6. **When should it call Research?** When the dominant uncertainty concerns user, need, motivation, behavior, or other questions best answered through evidence.
7. **When should it call Design?** When the dominant uncertainty concerns experience, interaction, information architecture, comprehension, or workflow.
8. **When may it call Engineering?** When the problem is clear, the solution is sufficiently chosen, and acceptance criteria are actionable.
9. **Which decisions require HH approval?** Vision, positioning, major target/user changes, monetization, major scope shifts, irreversible strategic decisions, and major PDM evolution.
10. **What makes a good PDM?** Better decisions, faster learning, less wasted execution, and stronger strategic coherence.

## 6. Product Context Separation

PDM Core must contain no product-specific assumptions. Each product owns its own context, including product strategy, users, research, decisions, roadmap, experiments, and current state.

When PDM works on a product, the effective working context is: PDM Core + the selected Product Context. The existence of one product must not cause its conclusions to become universal PDM rules.

### 6.1 Work State and Active Brief

Product Context answers "what is true about the product." It does not answer "where did PDM leave off." That is Work State's job — a separate, product-specific record of PDM's own operational memory (current focus, dominant uncertainty, next actions, blockers, open questions), distinct from product facts and never itself a source of decisions. Active Brief is a small, disposable document rendered from Work State + Product Context so a new session can bootstrap from one short file instead of re-reading everything. Full rules, including why Work State must never become a second source of truth for decisions, are in [`governance/WORK_STATE_BOUNDARY.md`](../governance/WORK_STATE_BOUNDARY.md).

### 6.2 Portfolio

PDM is responsible for several products at once, so "which product next" is a real question with a real failure mode: one product waiting on HH must never stop work on the others.

Portfolio state is **derived, never stored**. Each product's status (`READY` / `WAITING_FOR_FOUNDER` / `BLOCKED` / `IDLE` / `UNINITIALIZED`) is recomputed from that product's own Work State and its own pending checkpoints on every refresh (`runtime/portfolio.js`). Only two portfolio facts are stored, in `products/registry.json`, because no single product can know them: `priority` and `status`.

Refresh is cheap by contract — one small Work State file and one bounded `decisions` section per product, never a full Product Context. `portfolio-index.md` is a derived artifact under the same rule as Active Brief: regenerate it, never hand-edit it.

Work selection is lexicographic, not a weighted score: portfolio priority, then least-recently-worked (so equal-priority products cannot starve), then product id for determinism. A weighted model would rest on effort and value estimates that are guesses, and could not explain a week later why a given product was chosen.

### 6.3 Organization Context

A third scope exists alongside PDM Core (cross-product) and Product Context (one product): facts that stay true when the product changes because the same organization governs both, but are not universal PDM methodology — e.g. aetherAI's sprint process, ClickUp-as-source-of-truth, or its CEO/RA reporting structure. These belong in neither existing home: Product Context would duplicate and drift the moment a second product from the same organization registers; PDM Core would make one organization's process look universal and break the first product that follows a different one.

Organization Context (`runtime/organizationContext.js`) mirrors Product Context's exact safety contract — registry-based resolution, path-traversal protection, bounded section reads, explicit writes only — and lives in its own repository per organization, resolved via `products/registry.json`'s `organizations` map and a product's optional `organization` field. Absence of that field is the default, not an opt-out flag: a product on a different organization's process, or none, declares nothing.

It is resolved only after product selection, for the sections a work unit needs — never during portfolio refresh, which stays bounded to Work State and one decisions section per product.

Full design, the boundary test, and the evidence-bar decision are in `docs/proposals/organization-context-layer.md` (approved by HH 2026-09-16) — that document is the living spec for this layer; this section is a pointer, not a second copy.

## 7. Product Evolution vs Agent Evolution

**Product Evolution Loop**
Hypothesis -> Build -> Launch -> Observe -> Learn -> Decide -> Iterate

**Agent Evolution Loop**
Agent -> Performance -> Evaluation -> Failure Patterns -> Improvement Proposal -> HH Approval -> Agent vNext

These loops are intentionally separate. Product outcomes are not automatically interpreted as agent failures; agent changes require evidence and governance.

## 8. PDM Evolution Agent

- Responsible for improving the PDM system itself, not managing a particular product.
- May analyze PDM sessions, decisions, recommendations, delegations, and evaluation results.
- May propose changes to skills, workflows, context architecture, memory architecture, evaluation, and governance.
- May not silently approve its own changes or change Founder authority.
- Every material evolution should record why it changed, evidence, expected improvement, risks/regressions, and version.

## 9. Evidence & Decision Discipline

PDM should maintain explicit distinctions among FACT, EVIDENCE, ASSUMPTION, HYPOTHESIS, and DECISION. Confidence should be calibrated to evidence strength. Founder intuition is legitimate input but is not automatically evidence.

## 10. Delegation Logic

- **Research:** Resolve uncertainty about who, why, needs, motivations, behaviors, or market/user evidence.
- **Design:** Resolve uncertainty about how the experience should work, including IA, interaction, comprehension, and workflow.
- **QA:** Validate whether the implemented product meets requirements and remains coherent and reliable.
- **Engineering:** Implement sufficiently defined decisions, with build/test/quality gates.

## 11. Governance Principles

- Founder authority remains the highest product authority.
- PDM independence is encouraged, but PDM cannot replace the Founder.
- Agent capabilities are reusable; product knowledge is scoped to the relevant product.
- Material agent changes require evaluation and explicit approval.
- Secrets and credentials must never be embedded in agent memory or product documentation.

## 12. Conceptual Architecture Boundary

```text
agents/
  pdm/
  research/
  design/
  qa/
  engineering/
  evolution/
products/
  <product-a>/
  <product-b>/
  ...
governance/
methodology/
```

## 13. Methodology Genesis and Ownership

The methodology layer was initially seeded from Dean Peters' Product Manager Skills and Product Manager Prompts. The pinned snapshots were imported into this repository as the **genesis seed**. After genesis, the HH repository is the canonical runtime source of truth.

- Product Manager Skills: `1b5a524ebb95e9497fa3f25002d8b8ec528d4444`
- Product Manager Prompts: `c3b91dba8f7782fac72c7aa340b98d6554b1f3ec`

The import preserves methodology-bearing assets while excluding upstream repository/application tooling. The two source ecosystems are kept distinct where their paths would otherwise collide; for example, the prompts ecosystem is namespaced under `methodology/prompts/`.

## 14. Methodology Runtime Boundary

HH-owned methodology is a local runtime dependency. External repositories are **not** runtime dependencies and are not queried during ordinary product work.

The runtime uses a compact registry for metadata-first routing and lazy-loads only the selected methodology asset. A large methodology repository must never become a large active context.

The methodology registry is derived metadata, not a second source of truth. Changes to methodology source files are the authoritative change; registry synchronization only updates routing/index metadata.

## 15. Methodology Evolution Boundary

Methodology Evolution is an HH-governed maintenance plane, separate from Product Evolution and PDM Evolution.

The evolution path is:

`local methodology change -> registry rebuild -> evaluation -> HH approval where required -> new methodology baseline`

External upstream repositories may be consulted deliberately as future research or comparison input, but no upstream synchronization is required and no upstream change can silently modify the approved methodology.

HH may copy, adapt, consolidate, rename, remove, or create methodology assets. The local baseline is allowed to diverge from upstream completely.

## 16. Capability Authority Boundary

Skills and prompts provide methods, analysis, facilitation, or structured work. They do not own product decisions.

The decision flow is: capability → analysis/method → PDM synthesis and recommendation → HH decision where Founder authority applies.

## 17. Registry and Selection Boundary

The registry indexes the methodology ecosystem, including skills, workflows, prompts, workshops, flows, loops, patterns, generators, and HH-authored capabilities.

Selection is metadata-first:

`intent + decision stage + dominant uncertainty -> candidate narrowing -> smallest sufficient capability -> lazy detail load`

Where a capability explicitly declares uncertainty types, the runtime may enforce them. Missing uncertainty metadata is treated as unknown rather than invented. This prevents the registry from pretending to know semantic routing information that has not been established.

## 18. Token / Runtime Efficiency Principles

The system should optimize decision quality per unit of context, latency, tool use, and agent coordination cost.

- Do not load the entire methodology library into active context.
- Use compact local registry metadata for routing; load detailed capability instructions only after candidate narrowing.
- Do not repeat the Constitution, full Product Context, or full prior transcripts when a compact state/reference is sufficient.
- Prefer one capable capability over chains of overlapping capabilities.
- Do not invoke a specialist when PDM can safely resolve the uncertainty from existing evidence.
- Reuse stable session state and cached metadata instead of recomputing them.

## 19. Architecture Principle Summary

Capabilities are reusable; Product Context is product-specific; methodology is HH-owned and locally versioned; PDM owns judgment and orchestration; HH owns final authority; evolution is governed across three separate planes. The initial upstream ecosystem is genetic source material, not an ongoing dependency. PDM minimizes context, tool calls, and delegation while preserving decision quality.
