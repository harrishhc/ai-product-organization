# vendor/

Reserved for pinned, provenance-tracked snapshots of external methodology
(e.g. Dean Peters' Product Manager Skills / Product Manager Prompts), per
[`Upstream_Methodology_Governance_and_Sync_Specification`](../methodology/README.md).

**This directory is intentionally empty for now** — not because importing is
architecturally forbidden, but because it hasn't been done yet in this
bootstrap. The approved model is **import/adapt once or deliberately, not a
live upstream dependency**:

```
External methodology -> initial selective import/copy -> HH-owned methodology
  -> HH adaptation/consolidation/deletion/extension -> HH methodology baseline
  -> PDM runtime
```

A one-time (or periodically deliberate) seed import of selected Dean-derived
capabilities into the HH repository is an expected, normal bootstrap step —
it is not the same thing as the "live sync" the governance spec forbids.
What is forbidden is the PDM *runtime* querying, checking, or depending on
the upstream repositories during ordinary sessions.

Performing the actual import requires:

1. HH's go-ahead to do it now (not required for every ordinary task — this
   is a one-time/occasional maintenance action, not a recurring gate).
2. Network access to fetch the upstream repository.
3. A recorded provenance file (upstream URL, commit SHA, snapshot date,
   license/attribution, sync status) alongside the copied content.
4. Adapting the copied material into the HH methodology baseline
   (`methodology/registry/` + `methodology/capabilities/`) — after which HH
   may freely modify, merge, split, rename, extend, or retire it. No
   upstream-compatibility requirement is introduced.

Re-checking upstream for *later* changes (as opposed to this initial import)
is the part that must stay a deliberate, separately-invoked Methodology
Evolution task — see `runtime/methodologyEvolution.js` — never a side effect
of ordinary product/PDM work, and never performed automatically by anything
in `runtime/`.

Until the import happens, the Capability Registry
(`methodology/registry/registry.json`) indexes only HH-original placeholder
capabilities so the routing/lazy-loading mechanics are real and testable.
