# Start Here — the methodology baseline in this repository

This directory is the HH-owned methodology baseline: 491 indexed assets, of
which 86 are **entrypoints** PDM may select (a skill's `SKILL.md`, a
`capabilities/` asset, a `commands/` workflow). Everything else — a
`template.md`, an `examples/` file, a README — belongs to an entrypoint rather
than being a choice of its own.

It is not read by browsing. PDM reaches it through the runtime, and that path
is what this file describes.

## How methodology is actually reached here

```text
node bin/pdm-run.mjs next
        ↓  prints the selected product, its dominant uncertainty,
           and a routing shortlist with the top entrypoint's anti-cues
selectCapability({ dominantUncertainty, intents, decisionStage })
        ↓  metadata-only narrowing over all 86 entrypoints
resolveSelectedComposition(selected)
        ↓  what it is built from, and which workflows it is a member of
loadSelectedCapability(...)   ← the only step that loads a file
```

Detail is loaded only after selection, one entrypoint at a time. Read
[`../AGENTS.md`](../AGENTS.md) for the operating rules and
[`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) §17 for the selection
boundary.

**Routing reads each asset's own frontmatter** — `description` (which states
its own trigger), `intent`, `type`, `theme`, `best_for`, `scenarios`,
`estimated_time`, and `uses:`/`outputs:` on commands. Editing a skill's
frontmatter therefore changes how it routes; `.github/workflows/registry-sync.yml`
regenerates `registry/ecosystem.json` on every push.

**A matching invocable Skill is the low-cost door for authoring**, for the 14
entrypoints that have one — but this repository's copy is canonical. See
[`../governance/AUTONOMY_BOUNDARY.md`](../governance/AUTONOMY_BOUNDARY.md) §1
for why, and for what exists only here.

## Human entry points

- [`../docs/GETTING_STARTED.md`](../docs/GETTING_STARTED.md) — how HH starts a
  worker session and where to work with PDM.
- [`../AGENTS.md`](../AGENTS.md) — the provider-neutral agent contract.

## What the upstream import did and did not bring

The baseline was seeded from
[deanpeters/Product-Manager-Skills](https://github.com/deanpeters/Product-Manager-Skills)
at commit `1b5a524` on 2026-09-10 (`Phase 3: methodology genesis + ecosystem
runtime`). See [`provenance/`](provenance/) for the record.

The methodology came in: `skills/` (77), `commands/` (6), `prompts/`,
`workshops/`, `loops/`, `market-intelligence/`, `prompt-generators/`,
`skeletons/`, and each skill's own `template.md`, `examples/` and `scripts/`.

The upstream repository's **own operating manual did not**, and is not
missing by oversight — this repository reaches methodology programmatically,
so each piece already has a replacement here:

| Upstream | Replacement here |
|---|---|
| 20 per-tool setup guides (`docs/Using PM Skills with n8n.md`, `…with Cursor.md`, …) | Not applicable. PDM loads assets through `runtime/registry.js`; no one copies files into a tool by hand. |
| 4 onboarding docs (`docs/Using PM Skills 101.md`, `docs/Platform Guides for PMs.md`, …) | `../docs/GETTING_STARTED.md` and `../AGENTS.md` |
| `scripts/find-a-skill.sh --keyword X` | `runtime/orchestrator.js#selectCapability` — ranks all 86 entrypoints by fit, surfaces anti-cues, and resolves composition |
| `scripts/run-pm.sh skill <name> "<task>"` | `bin/pdm-run.mjs next` plus `loadSelectedCapability` / the `Skill` tool |
| `scripts/generate-catalog.py` → `catalog/*.yaml` | `../scripts/build-methodology-registry.mjs` → `registry/ecosystem.json`, which covers all 86 entrypoints with routing metadata and composition, and is rebuilt on every push |

A previous version of this file was the upstream copy, listing 27 files that
were never imported. Every link in it was dead.
