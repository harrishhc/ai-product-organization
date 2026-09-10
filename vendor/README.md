# vendor/

Reserved for pinned, provenance-tracked snapshots of external methodology
(e.g. Dean Peters' Product Manager Skills / Product Manager Prompts), per
[`Upstream_Methodology_Governance_and_Sync_Specification`](../methodology/README.md).

**This directory is intentionally empty.**

Populating it requires:

1. An explicit, deliberate methodology-maintenance task initiated by HH (not
   ordinary product/PDM work).
2. Network access to fetch the upstream repository.
3. A recorded provenance file (upstream URL, commit SHA, snapshot date,
   license/attribution, sync status) alongside the copied content.
4. HH approval before the copied material enters the HH methodology baseline
   used by the Capability Registry.

Until that happens, the Capability Registry (`methodology/registry/registry.json`)
indexes only HH-original placeholder capabilities. The PDM runtime never
reads from this directory during ordinary sessions, and nothing in
`runtime/` performs network access — see `runtime/methodologyEvolution.js`
for the one explicitly-gated exception.
