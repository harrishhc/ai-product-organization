# AI Product Organization Architecture

v0.3 - HH AI Product Organization

## 1. Purpose

建立一個可跨產品重用、可持續演化的 AI Product Organization。HH 作為 Founder / CEO，PDM 作為 Senior Product Director；Research、Design、QA、Engineering 則是可跨產品重用的職能 agents。產品本身持續迭代，而 agent 能力也可透過獨立的 evolution system 持續改善。

## 2. Core Architecture

核心原則：Capabilities are reusable. Context is product-specific. Products continuously evolve. Agents continuously improve. Governance prevents cross-contamination.

| Layer | Purpose | Scope |
|---|---|---|
| PDM Core | 產品管理能力、判斷框架、workflow、governance、evaluation | 跨產品 reusable |
| Product Context | 單一產品的 strategy、users、research、decisions、roadmap、current state | product-specific |
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
