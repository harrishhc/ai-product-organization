---
id: prd-structure-convention
type: component
source: hh-original
version: 0.2.0
---

# PRD Structure Convention

## Correction (2026-09-18)
v0.1.0 of this file defined a whole parallel PRD skeleton (header, overview,
positioning, scope, out-of-scope, open items, superseded-content) as if
nothing in `methodology/` already covered that. It does:
`methodology/skills/prd-development/SKILL.md` orchestrates exactly that
skeleton (Problem, Users, Solution, Success Metrics, User Stories, Out of
Scope, Dependencies, Open Questions) and its own text says the workflow
"slots [given input] into the right phases and skips what's already
answered" and "arriving empty-handed? That works too." TAM/SAM/SOM,
Persona, and Story-Map are marked **Optional** inline — the workflow is
already built to be cut down to only the sections a given product needs.
`colon-biopsy-ai-app/docs/PRD.md`'s structure (Overview → Scope-with-
citations → Out of scope → Open items → Superseded-content) is not a
different skeleton from `prd-development`'s — it's `prd-development` run
with Phases 3/4/6 (Personas, Strategic Context/TAM-SAM, Success Metrics)
skipped as inapplicable to an already-shipping product being reconciled,
not framed from scratch. v0.1.0 was written without reading
`prd-development`'s full `SKILL.md` — only its `registry.json` metadata,
whose `anti_cues` don't mention this case and whose `cost_profile: high`
reads as "heavyweight, discovery-only" out of context. That is a real
methodology-registry gap (fixed in the same change as this correction —
see `prd-development`'s registry entry), not a reason to duplicate the
skeleton here.

This file is now a **thin adapter**: it exists only for the one thing
`prd-development` genuinely does not cover — this repo's own two-layer
memory (Product Context + PRD), which `prd-development` has no concept of.
It does not restate `prd-development`'s skeleton, phases, or vocabulary.

## Purpose
When applying `prd-development` inside this repo, state how the resulting
`docs/PRD.md` relates to the product's Product Context (`context.json`) —
because `prd-development` assumes the PRD itself is the single source of
truth, and in this repo it isn't.

## When to use
Immediately after applying `prd-development` (in full or with phases
skipped) to produce or update a product's `docs/PRD.md` — never as a
replacement for it.

## Method
1. **Run `prd-development`** (`methodology/skills/prd-development/SKILL.md`)
   against the product. Skip phases the product genuinely has no material
   for (see its own "Optional" phases and "arriving empty-handed" note) —
   that is normal use of that skill, not a deviation requiring a different
   capability.
2. **Cite sources, not memory, in the Problem/Scope/Solution sections.**
   `prd-development`'s own examples are for a from-scratch feature and cite
   interviews/analytics. When reconciling an already-shipping product
   instead, the equivalent citation is a ClickUp ticket, an IFU/regulatory
   document, or a `context.json` entry — still a citation, same principle,
   different source type.
3. **Add one explicit statement `prd-development` has no section for** — the
   PRD's relationship to Product Context:

   > Canonical source: this document is a narrative view of the product's
   > Product Context (`context.json`, path per the product's registry
   > entry). If the two disagree, Product Context is authoritative. Real
   > history is `git log`, not a hand-maintained changelog.

4. **Route new findings through Product Context first.** A fact discovered
   while writing or reviewing the PRD is written to `context.json` via the
   normal write path before the PRD is updated to reflect it — the PRD
   never becomes a second place where a product fact is first recorded.
5. **Use one evidence vocabulary.** This repo's own FACT/EVIDENCE/ASSUMPTION/
   HYPOTHESIS/DECISION labels (`governance/EVIDENCE_DISCIPLINE.md`) or
   `prd-development`'s own 🔶/🔵 tags — pick one per repo and don't mix them
   in the same document. (Not a claim that one is objectively better; a
   claim that a reader who sees both in one file will assume they mean
   different things.)

## Output
A `docs/PRD.md` produced by `prd-development` that additionally states its
subordinate relationship to `context.json`, so nothing downstream mistakes
it for a second authoritative source.

## Pitfalls
- Re-deriving a "shared skeleton" from scratch instead of just running
  `prd-development` with the inapplicable phases skipped.
- Treating the PRD as authoritative and letting it silently diverge from
  `context.json` after the next research finding.
- Introducing a new fact or "Open item" directly in the PRD instead of
  recording it in `context.json` first.
