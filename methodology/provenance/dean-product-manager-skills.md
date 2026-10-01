# Provenance Record: Dean Peters — Product Manager Skills (initial seed)

Governance-layer record, per Upstream Methodology Governance & Sync
Specification §5.

**The `vendor/` snapshot this paragraph once pointed to no longer exists.**
The 2026-09-10 genesis import (`508039a`) vendored the full upstream tree at
`vendor/dean-product-manager-skills/`, moved the four initially-adopted skills
into `methodology/skills/` (a rename, content preserved), then deleted the rest
of `vendor/` — including `vendor/dean-product-manager-skills/PROVENANCE.md`,
a per-file provenance table — as a "duplicate genesis vendor snapshot," on the
premise that `methodology/` was now the canonical HH-owned copy. That premise
holds for the skill content itself, but the deleted file's actual, non-duplicate
job was recording *where each file came from*, and nothing replaced it.

The detail is reconstructable, not preserved: the **Upstream commit** pinned
below is the exact upstream state this baseline was seeded from. Diffing that
commit against `methodology/` reproduces the same per-file provenance the
deleted table held. This file records the adoption event at the
methodology-baseline level.

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

## What the import did not bring, and why that is not a gap

Recorded 2026-09-21, because the question came up twice: the genesis commit's
message reads `import methodology genesis baseline`, which sounds like
*everything*, and `methodology/START_HERE.md` was carried in referencing 27
upstream files that were never imported — every link in it was dead. That file
has been removed; this section is the durable answer in its place.

**The methodology came in:** from the Skills source, `skills/` (77),
`commands/` (6), `catalog/`, and each skill's own `template.md`, `examples/`
and `scripts/`. From the Prompts source, everything under `prompts/` — which
namespaces that whole ecosystem, including its own `workshops/`, `loops/`,
`market-intelligence/`, `prompt-generators/`, `skeletons/`, `storytelling/`,
`vibes/`, `flows/`, `catalog/` and `skills/` subdirectories.

**Those Prompts-source directories live only under `prompts/`.** Copies of
eight of them also sat at `methodology/`'s top level until 2026-09-29, when
93 byte-identical duplicate files were removed. Root cause, recorded here so
it cannot be reintroduced by the same route. What is directly observable in
the squashed commit `508039a`: the Prompts ecosystem's top-level directories
were added at `methodology/` unsuffixed, three files carry a `.prompts`
suffix, and the same content was also added under `prompts/`. Its sub-commit
titles include `fix: isolate prompt ecosystem from skill sources` and four
occurrences of `feat: import methodology genesis baseline`. The reading that
fits this evidence is that the importer first wrote the Prompts top level
straight into `methodology/`, a later sub-commit re-namespaced under
`prompts/`, and nothing cleaned up the first output — but that ordering and
mechanism are **inferred**, not recorded: the commit is squashed and the
importer was retired in the same commit, so its logic can no longer be
inspected. (An earlier version of this paragraph said every file operation in
`508039a` was an `A`. That was false: the commit is 492 A / 6 M / 6 D /
5 R100 — the renames are the `vendor/` → `methodology/` moves and the deletes
are four `capabilities/` files plus two `vendor/` files. It is true of, at
most, the Prompts-import portion, which cannot be separated out.)

**The upstream repository's own operating manual did not.** It answers "how do
I, a person, get these files into my AI tool and use them by hand" — a workflow
this repository replaced with programmatic resolution. Each omitted piece
already has a more capable equivalent here:

| Upstream | Equivalent here |
|---|---|
| 20 per-tool setup guides (`docs/Using PM Skills with n8n.md`, `…with Cursor.md`, …) | Not applicable. PDM resolves assets through `runtime/registry.js`; nothing is copied into a tool by hand. |
| 4 onboarding docs (`docs/Using PM Skills 101.md`, `docs/Platform Guides for PMs.md`, …) | `docs/GETTING_STARTED.md` for HH, `AGENTS.md` for a worker |
| `scripts/find-a-skill.sh --keyword X` (keyword grep over `catalog/`) | `runtime/orchestrator.js#selectCapability` — its direct descendant. Ranks all 86 entrypoints by fit, reports the match basis, surfaces `anti_cues`, and resolves composition. |
| `scripts/run-pm.sh skill <name> "<task>"` | `bin/pdm-run.mjs next`, then `loadSelectedCapability` |
| `scripts/generate-catalog.py` → `catalog/*.yaml` | `scripts/build-methodology-registry.mjs` → `methodology/registry/ecosystem.json`, covering all 86 entrypoints with routing metadata and declared composition, rebuilt by `.github/workflows/registry-sync.yml` on every push to `main` |

None of the three scripts is a gap to fill. `catalog/*.yaml` remains as imported
upstream material; nothing in the repository reads it, and
`methodology/registry/ecosystem.json` is the authoritative index.

Re-importing any of this later is Methodology Evolution work, and would need a
concrete failure case that the equivalents above do not cover.
