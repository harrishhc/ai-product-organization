# vendor/

Pinned, provenance-tracked snapshots of external methodology, per
[`Upstream_Methodology_Governance_and_Sync_Specification`](../methodology/README.md).
The approved model is **import/adapt once or deliberately, not a live
upstream dependency**:

```
External methodology -> initial selective import/copy -> HH-owned methodology
  -> HH adaptation/consolidation/deletion/extension -> HH methodology baseline
  -> PDM runtime
```

"No live runtime dependency on upstream" does not mean "never import the
seed." What's forbidden is the PDM *runtime* querying, checking, or
depending on the upstream repositories during ordinary sessions — not a
deliberate, one-time (or periodically deliberate) seed import.

## Contents

- `dean-product-manager-skills/` — an initial seed import from Dean Peters'
  Product Manager Skills, performed 2026-09-10. See
  [`dean-product-manager-skills/PROVENANCE.md`](./dean-product-manager-skills/PROVENANCE.md)
  for the exact commit, license, and which 4 skills (of the ~70+ available)
  were selected and why. These are byte-for-byte upstream copies — nothing
  in this directory is HH-adapted; the HH-adapted, registry-linked copies
  live in [`../methodology/capabilities/`](../methodology/README.md).

Nothing from Product Manager Prompts has been imported yet.

## Runtime rule (unchanged)

`runtime/registry.js` never reads from this directory. It resolves every
capability's detail exclusively from `methodology/capabilities/`, regardless
of whether that capability's `source` is `hh-original` or
`dean-product-manager-skills`. This directory exists for provenance,
auditing, and future diffing against later upstream changes — not as
something the runtime touches at decision-making time.

## Re-syncing later upstream changes

Checking whether these four skills (or anything else upstream) have since
changed is Methodology Evolution work — a deliberate, separately-invoked
task (see `runtime/methodologyEvolution.js`), never a side effect of
ordinary product/PDM work, and never performed automatically.
