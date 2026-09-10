# Methodology

The HH-owned methodology baseline: the operational source of truth used by the
PDM runtime at decision-making time. See [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md)
§13, §15 and the `PDM_Skill_Capability_Registry_and_Selection_Specification`
and `Upstream_Methodology_Governance_and_Sync_Specification` for full context.

- Upstream methodology (`../vendor/`) is a governed dependency, not a live
  runtime dependency. It is currently empty — nothing has been vendored yet.
- Only the locally approved HH methodology baseline (this directory) is
  loaded into active context. No network access is required, or performed,
  during ordinary PDM/product sessions.
- Evolution path: upstream change → diff → classify → validate → impact
  review → HH approval → vendor update → registry update → evaluation. This
  path runs only via `runtime/methodologyEvolution.js`'s explicit,
  separately-invoked maintenance entry point — never as a side effect of
  ordinary orchestration.

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
