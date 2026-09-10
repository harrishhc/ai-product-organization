# Provenance: Dean Peters — Product Manager Skills

Per [`Upstream_Methodology_Governance_and_Sync_Specification`](../../methodology/README.md)
§5 (Version Pinning & Provenance).

- **Upstream repository:** https://github.com/deanpeters/Product-Manager-Skills
- **Upstream commit:** `1b5a524ebb95e9497fa3f25002d8b8ec528d4444` (branch `main`)
- **Snapshot/import date:** 2026-09-10
- **Upstream version/release:** none tagged at time of import; pinned to commit above
- **License:** CC BY-NC-SA 4.0 (see [`LICENSE`](./LICENSE) in this directory, copied verbatim from upstream)
- **Attribution:** Dean Peters, Product Manager Skills
- **Sync status:** current (initial import; no re-sync performed)

## What was imported

This is a deliberate, one-time **initial seed import** (not a live dependency
and not the full upstream ecosystem — see [`../README.md`](../README.md)).
Four skills were selected because they cover the core PDM decision lifecycle
named in the Capability Integration Specification's initial capability list
(frame → discover → prioritize → document), and no more than that:

| Upstream skill | Upstream path | Local HH id |
|---|---|---|
| `problem-framing-canvas` | `skills/problem-framing-canvas/SKILL.md` | `problem-framing-canvas` (replaces the earlier HH-original placeholder of the same name) |
| `discovery-process` | `skills/discovery-process/SKILL.md` | `discovery-process` (new; added alongside, not replacing, the existing HH-original `discovery-question-set`) |
| `prioritization-advisor` | `skills/prioritization-advisor/SKILL.md` | `prioritization-advisor` (new; added alongside, not replacing, the existing HH-original `prioritization-comparison`) |
| `prd-development` | `skills/prd-development/SKILL.md` | `prd-development` (new; added alongside, not replacing, the existing HH-original `prd-readiness-gate`) |

Three skills are additive rather than replacements because they are not the
same capability as their HH-original counterpart, just adjacent in the same
area — see each HH-adapted file's provenance header in
`methodology/capabilities/` for the specific rationale, and
[`methodology/README.md`](../../methodology/README.md) for how PDM is meant
to choose between them.

`problem-framing-canvas` was a genuine 1:1 replacement: the HH-original
placeholder of that name served the same purpose at the same tier, so
adopting the real method was preferred over keeping an invented stand-in.

## Local modifications

None to the skill bodies — each file under `skills/` here is a byte-for-byte
copy of the upstream file at the pinned commit. The HH-adapted copies in
`methodology/capabilities/` add a provenance header only; the method,
structure, and content below that header are unmodified. Capability Registry
metadata (`primary_intents`, `decision_stage`, `selection_cues`, `anti_cues`,
etc.) is HH-authored to fit these skills into the PDM Capability Registry —
that metadata is not part of the upstream skill and carries no upstream
authority.

Two skills reference sibling skills not imported in this seed
(`workshop-facilitation`, `problem-statement`, `discovery-interview-prep`,
`opportunity-solution-tree`, etc.). Those cross-references are left as-is
for fidelity; they simply won't resolve inside this repository until (if
ever) those skills are separately imported through a future deliberate
methodology-maintenance task.

## Re-sync

Checking for upstream changes to these four skills, or importing additional
skills, is Methodology Evolution work (`runtime/methodologyEvolution.js`),
never a side effect of ordinary PDM/product sessions.
