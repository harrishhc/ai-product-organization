# Provenance Record: Dean Peters — Product Manager Skills (initial seed)

Governance-layer record, per Upstream Methodology Governance & Sync
Specification §5. The raw pinned snapshot and the detailed per-file
provenance live in [`vendor/dean-product-manager-skills/PROVENANCE.md`](../../vendor/dean-product-manager-skills/PROVENANCE.md);
this file records the adoption event at the methodology-baseline level.

- **Upstream repository:** https://github.com/deanpeters/Product-Manager-Skills
- **Upstream commit:** `1b5a524ebb95e9497fa3f25002d8b8ec528d4444` (branch `main`)
- **Import date:** 2026-09-10
- **Sync status:** current (initial import; no upstream re-sync performed since)
- **Type of change:** initial selective seed import (Upstream Governance §2 model:
  external methodology → deliberate review/adoption → HH methodology baseline),
  not a live dependency and not a full-ecosystem import.

## Capabilities adopted into the HH methodology baseline (`registry.json` v0.2.0)

| Local id | Upstream skill | Relationship to existing HH-original capabilities |
|---|---|---|
| `problem-framing-canvas` | `problem-framing-canvas` | Replaces the earlier HH-original placeholder of the same id/purpose |
| `discovery-process` | `discovery-process` | Added alongside `discovery-question-set` (different tier/scope, not a duplicate) |
| `prioritization-advisor` | `prioritization-advisor` | Added alongside `prioritization-comparison` (framework selection vs. framework application) |
| `prd-development` | `prd-development` | Added alongside `prd-readiness-gate` (authoring workflow vs. readiness gate) |

## Why these four, and no more

The Capability Integration Specification's initial capability list names 13
candidate upstream skills. Importing all of them "for completeness" was
explicitly rejected in favor of the smallest useful subset: these four cover
the core PDM decision lifecycle end-to-end (frame → discover → prioritize →
document) and directly correspond to capabilities this bootstrap already
needed placeholders for. The remaining candidates
(`context-engineering-advisor`, `agent-orchestration-advisor`,
`product-strategy-session`, `opportunity-solution-tree`, `roadmap-planning`,
`pol-probe-advisor`, `pol-probe`, `competitive-analysis-process`,
`intel-discipline-advisor`) were not imported in this pass. Importing any of
them later is Methodology Evolution work, not an automatic follow-on.

## Runtime resolution

`runtime/registry.js` resolves every capability's `source_reference` from
`methodology/capabilities/` only — it never reads from `vendor/`, regardless
of a capability's `source`. This import changed no runtime code; only
methodology data (`registry.json` + `methodology/capabilities/*.md`) and the
new vendor snapshot were added.
