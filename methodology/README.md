# Methodology

The HH-owned methodology baseline: the operational source of truth used by the
PDM runtime at decision-making time. See [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md)
§13, §15 and the `PDM_Skill_Capability_Registry_and_Selection_Specification`
and `Upstream_Methodology_Governance_and_Sync_Specification` for full context.

- Upstream methodology (`../vendor/`) is meant as **initial seed material**
  for HH methodology — imported/adapted once or deliberately, not depended on
  live. "No live runtime dependency on upstream" does not mean "never import
  the seed"; it means the PDM runtime never queries, checks, or requires
  upstream availability during ordinary sessions. See
  [`../vendor/README.md`](../vendor/README.md) for the distinction between
  the (expected, normal) one-time seed import and the (deliberate,
  governance-gated) ongoing sync of later upstream changes.
- It is currently empty because the seed import hasn't happened yet in this
  bootstrap, not because it's architecturally disallowed.
- Only the locally approved HH methodology baseline (this directory) is
  loaded into active context at runtime. No network access is required, or
  performed, during ordinary PDM/product sessions.
- Sync/re-review path for *later* upstream changes: upstream change → diff →
  classify → validate → impact review → HH approval → vendor update →
  registry update → evaluation. This path runs only via
  `runtime/methodologyEvolution.js`'s explicit, separately-invoked
  maintenance entry point — never as a side effect of ordinary orchestration.

## Layout

```
methodology/
  registry/       compact, cheap-to-scan capability metadata (registry.json)
  capabilities/   detailed capability instructions, lazily loaded only
                  after the registry narrows candidates
  provenance/     provenance records for any adopted external material
                  (empty until something is actually vendored + approved)
```

## Current baseline

The registry currently indexes a small set of **HH-original placeholder
capabilities** (`source: "hh-original"`), not vendored Dean Peters content —
vendoring has not happened yet (see [`../vendor/README.md`](../vendor/README.md)).
These placeholders exist so the registry/resolver/lazy-loading mechanics are
real and testable without depending on, or fabricating, external content.

## Candidate upstream sources (not yet vendored; reviewed only via an explicit maintenance task)

- https://github.com/deanpeters/Product-Manager-Skills
- https://github.com/deanpeters/product-manager-prompts
