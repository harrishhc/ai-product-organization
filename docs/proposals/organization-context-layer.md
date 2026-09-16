# Proposal — Organization Context Layer

**Status:** APPROVED by HH 2026-09-16 (§9.1–9.2). Implementation pending: repo creation needs an explicit go-ahead (§9.3), `runtime/` still unchanged.
**Authority:** Material PDM evolution → HH review required (`PDM_CONSTITUTION.md` Authority Matrix)
**Raised:** 2026-09-14
**Updated:** 2026-09-15
**Decided:** 2026-09-16
**Note:** this revision switched from Chinese to English with no stated reason, while `capability-routing-fix.md` (same day) stayed Chinese. Unexplained — flagging rather than guessing at intent; tell PDM if this should be a deliberate per-document or per-audience convention.

---

## 0. Why this proposal is being revisited

The original proposal was intentionally conditional because there was only one real product. The current portfolio now contains multiple real products belonging to the same organization, so that condition is satisfied.

The proposal also keeps an important correction from the original analysis: the first live-pilot failure was not evidence that an Organization Context layer was required. It was a Product Context completeness problem. That product-level issue was fixable with the existing architecture and must not be used to justify a new organizational layer.

The case for Organization Context is now structural **and operationally relevant**: multiple real products share organization-specific delivery conventions, while PDM Core must remain organization-agnostic.

**This rewrite also changes the evidence bar the original version used, and that change was not previously flagged.** The original recommendation (§5 of the 2026-09-14 version) was explicitly conditional and leaned toward *not* building this layer yet, for a stated reason: `GOVERNANCE_PRINCIPLES.md`'s discipline against justifying a new layer on structural argument alone — it required an observed failure case, which did not exist. That version's own words: "結構論證很清楚,但結構論證正是該文件說不夠的那種論證" ("the structural argument is clear, but a structural argument is exactly the kind this document says is insufficient"). This rewrite recommends building the layer now, on product count (1→4) alone, with no new observed failure. That is a reversal of the bar, not a new application of the same bar. See §8.1 for the explicit confirmation this requires before HH approval is meaningful.

## 1. Problem: three scopes, only two existing homes

`docs/ARCHITECTURE.md` separates:

| Scope | Existing home |
|---|---|
| Cross-product reusable | PDM Core / methodology / functional agents |
| Product-specific | Product Context / Work State / Active Brief |

There is a third class of facts:

> facts that remain true when the product changes because the same organization governs both products, but are not universal PDM rules.

Examples from the current aetherAI product work include sprint/refinement conventions, role boundaries, ClickUp/Drive source-of-truth conventions, and recurring reporting obligations.

Putting these in Product Context duplicates them across products. Putting them in PDM Core makes an aetherAI-specific process look universal and breaks products that belong to another organization or follow a different process.

## 2. Proposed shape

Add an **Organization Context** layer that mirrors the existing Product Context pattern without creating a second operational memory system.

```text
PDM Core
    + Organization Context (optional)
    + Product Context
    + Work State / Active Brief
```

A product explicitly declares its organization. A product with no organization declaration receives no Organization Context.

### 2.1 Registry

`products/registry.json` should eventually support:

```json
{
  "organizations": {
    "aetherai": {
      "repository": {
        "type": "git_remote",
        "remote_url": "git@github.com:harrishhc/aetherai-organization-context.git",
        "local_clone_path": "./.organization-clones/aetherai"
      },
      "context_entry": "org-context.json"
    }
  },
  "products": {
    "colon-biopsy-ai-app": {
      "organization": "aetherai"
    }
  }
}
```

The exact remote repository name is illustrative and should be confirmed before creation.

### 2.2 Resolution

```text
PDM → Product Registry → selected product
                         ├── Product Context
                         └── Organization Context (if declared)
```

Resolution remains metadata-first and bounded. Organization Context is never loaded during portfolio refresh.

### 2.3 Runtime

Add a small `runtime/organizationContext.js` only after the repository and registry shape are approved.

It should mirror the Product Context safety contract:

- registry-based resolution;
- path-traversal protection;
- bounded section reads;
- explicit writes only;
- no network side effects during ordinary resolution.

Do not introduce a generic "memory" abstraction that merges Product Context, Organization Context, and Work State. Their different scopes are the reason the layers exist.

### 2.4 Bounded sections

Initial sections should remain deliberately narrow:

- `delivery_process`
- `roles`
- `artifact_conventions`
- `reporting_obligations`
- `systems_of_record`
- `quality_or_regulatory_process_gates` when the statement is genuinely organizational rather than product-specific

## 3. Boundary test

Use one test before moving a statement into Organization Context:

> Replace Product A with Product B. If the statement remains true because the same organization governs both, it is a candidate for Organization Context. If it stops being true, it belongs to Product Context.

Examples:

| Statement | Scope |
|---|---|
| Sprint refinement → sprint plan meeting | Organization |
| Ticket must contain a Figma link before sprint | Organization |
| PM defines WHAT; RD self-organizes HOW | Organization |
| ClickUp is live source of truth for tickets | Organization |
| Drive PDM folder is the document destination | Organization |
| Biweekly CEO product reporting | Organization |
| Inform-level CADx positioning for colon | Product |
| Three-model inference / 11 classifications | Product |
| N=300 validation design | Product |
| TFDA/CDE classification for colon | Product |

The same statement may need qualification if an organization policy has explicit product-level exceptions. Organization Context should express the policy and exception mechanism, not silently erase the exception.

## 4. Storage recommendation

Organization Context should be independently durable from PDM Core and product repositories. For the current aetherAI case, the preferred end state is a dedicated private organization-context repository owned by HH.

The repository should contain:

```text
org-context.json
README.md
knowledge/        # supporting source/evidence when needed
```

PDM Core stores only the registry pointer and routing metadata; it does not copy the organization's facts.

This also means another organization can use the same PDM Core without inheriting aetherAI process assumptions.

## 5. Governance

Organization Context is **descriptive context, not authority**.

It must never override the PDM Constitution or Founder authority. An organization-level policy change that requires a business/organizational decision should be surfaced as a decision rather than silently rewritten because PDM inferred a new norm from one product.

Entries should carry provenance and applicability. A useful minimum is:

```text
classification: FACT | EVIDENCE | ASSUMPTION | HYPOTHESIS
source_ref
observed_at
applies_to: organization
confidence
```

A single product's behavior is not enough to silently promote a new rule to organization-wide fact.

## 6. Relationship to the existing memory boundary

This is not a second Work State.

- **Organization Context:** what is true about the organization/process.
- **Product Context:** what is true about one product.
- **Work State:** what PDM is currently doing for one product.
- **Active Brief:** compact derived bootstrap.
- **Decision records:** durable product/Founder decisions.

No layer should duplicate another layer's facts merely for convenience.

## 7. Implementation sequence

Do not make the runtime change before the context itself exists.

1. Create and validate the dedicated aetherAI Organization Context repository.
2. Extract organization-level facts from existing product material into that repository, preserving provenance and uncertainty classification.
3. Review the resulting context for boundary violations and duplication.
4. Add organization registry metadata.
5. Add bounded `organizationContext.js` with path and read-boundary tests.
6. Integrate Organization Context into selected-product context assembly only.
7. Verify that portfolio refresh still reads only its existing bounded inputs.
8. Run the four-product live portfolio and observe whether organization context actually reduces duplication or incorrect assumptions.

This sequence deliberately separates **content migration** from **runtime abstraction**. If the content does not demonstrate a stable cross-product scope, stop before adding runtime machinery.

## 8. Risks (restored from the 2026-09-14 version; not superseded by §0)

- **Junk-drawer risk.** Mitigated only if the §3 boundary test is actually applied at content-migration time, not retrofitted after the drawer already exists.
- **Runtime surface area.** One more resolution path is one more thing to test and keep bounded (§2.3, §5.2).
- **Premature abstraction.** If aetherAI ends up being the only organization this PDM Core ever serves, this layer is infrastructure built for a single instance — the exact cost this repository has repeatedly refused to pay elsewhere (`GOVERNANCE_PRINCIPLES.md`, "Deliberately Not Built"). Four products under one organization does not by itself rule this out; it is a real risk being accepted, not a risk that four products makes go away.

## 9. Open decisions for HH

**9.1 — RESOLVED by HH, 2026-09-16.** HH confirmed building now, on the reversed bar (product count 1→4, not an observed failure) — quote: "aetherAI Organization Context 就是要做，現在就四個產品了為什麼不做". This is the Founder decision the proposal asked for in §0; it supersedes the original interim recommendation. Recorded here, in the proposal itself, per `docs/ARCHITECTURE.md` §8 — this is PDM Evolution content, not a product decision, so it is not routed through `runtime/decisionRecord.js`.

**9.2 — RESOLVED.** Approved by the same decision (9.1 was the operative question; approving the abstraction was not a separate ask).

**9.3 — PDM proposes, pending explicit go-ahead to create it:** `harrishhc/aetherai-organization-context` (private). **Repository creation is a hard stop under `governance/AUTONOMY_BOUNDARY.md` §3 ("Creating or deleting repositories") regardless of 9.1's approval** — say go/no-go or a different name and PDM creates it.

**9.4 — PDM proposes, proceeding unless corrected:** all 4 currently active products (`colon-biopsy-ai-app`, `ocr-slide-label-reader`, `prostate-biopsy`, `slide-quality-control`) declare `organization: "aetherai"` — all 4 are aetherAI products in `products/registry.json` today; no product on a different process has been registered yet.

**9.5 — PDM proposes, proceeding unless corrected:** the initial bounded sections from §2.4 (`delivery_process`, `roles`, `artifact_conventions`, `reporting_obligations`, `systems_of_record`) as-is.

## 10. Non-goals

This proposal does not introduce:

- another Work State or general-purpose memory store;
- a product workflow/node graph;
- weighted portfolio scoring;
- automatic organizational policy inference;
- provider-specific memory;
- provider-specific scheduling;
- a mandatory PR for every decision.
