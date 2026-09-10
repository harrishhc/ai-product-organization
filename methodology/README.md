# Methodology

The HH-owned methodology baseline: the operational source of truth used by the
PDM runtime at decision-making time. See [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md)
§13, §15 and the `PDM_Skill_Capability_Registry_and_Selection_Specification`
and `Upstream_Methodology_Governance_and_Sync_Specification` for full context.

- Upstream methodology (`../vendor/`) is **initial seed material** for HH
  methodology — imported/adapted once or deliberately, never depended on
  live. "No live runtime dependency on upstream" does not mean "never import
  the seed"; it means the PDM runtime never queries, checks, or requires
  upstream availability during ordinary sessions.
- A small initial seed **has been imported** (2026-09-10, pinned to a single
  commit of Dean Peters' Product Manager Skills) — see
  [`./provenance/dean-product-manager-skills.md`](./provenance/dean-product-manager-skills.md)
  and [`../vendor/README.md`](../vendor/README.md) for what and why.
- Only the locally approved HH methodology baseline (this directory) is
  loaded into active context at runtime. No network access is required, or
  performed, during ordinary PDM/product sessions — `runtime/registry.js`
  resolves every capability from `methodology/capabilities/` only, and never
  reads `vendor/` at runtime, regardless of a capability's `source`.
- Sync/re-review path for *later* upstream changes (as opposed to this
  initial import): upstream change → diff → classify → validate → impact
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
  provenance/     provenance records for adopted external material
```

## Current baseline (registry.json v0.2.0, 7 capabilities)

- **3 HH-original** capabilities (`source: "hh-original"`): `discovery-question-set`,
  `prioritization-comparison`, `prd-readiness-gate` — small, focused, authored
  directly for this bootstrap.
- **4 imported from Dean Peters' Product Manager Skills**
  (`source: "dean-product-manager-skills"`, each carrying a `provenance`
  object with upstream repo/commit/license): `problem-framing-canvas`,
  `discovery-process`, `prioritization-advisor`, `prd-development`.

Several pairs are intentionally complementary rather than duplicates — e.g.
`prioritization-advisor` (pick a framework) typically precedes
`prioritization-comparison` (apply it to compare options); `prd-readiness-gate`
(go/no-go check) precedes `prd-development` (write the actual PRD). See each
entry's `composability` field in `registry.json`.

## Candidate upstream sources for future (deliberate) review

Only 4 of the ~70+ skills in Product Manager Skills, and nothing from Product
Manager Prompts, have been imported so far. Importing more is Methodology
Evolution work, not automatic:

- https://github.com/deanpeters/Product-Manager-Skills
- https://github.com/deanpeters/product-manager-prompts
