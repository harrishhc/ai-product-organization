---
id: prd-structure-convention
type: component
source: hh-original
version: 0.1.0
---

# PRD Structure Convention

## Purpose
Give every product repo's `docs/PRD.md` the same shared skeleton and evidence
vocabulary, so a document written for one product is legible without
relearning conventions, and so it doesn't drift into a second, unsynced copy
of Product Context. Observed gap (2026-09-17): `colon-biopsy-ai-app`'s
`docs/PRD.md` and `ocr-slide-label-reader`'s `docs/PRD.md` were each written
independently by different sessions — one reconciling git-verified current
state against `EVIDENCE_DISCIPLINE.md` vocabulary, the other applying the
external `prd-development` skill's from-scratch template (TAM/SAM,
persona-first, 🔶/🔵 tags) — with no shared structure or vocabulary between
them, despite both being live software products in the same portfolio that
outside units (RA, engineering, other PMs) will read.

## When to use
- Creating a product's first `docs/PRD.md`.
- Migrating a stale or external PRD (a Google Doc, a legacy spec) into the
  git-tracked repo.
- Reviewing an existing PRD for drift from Product Context.

## Relationship to Product Context (`context.json`)
`context.json` is the only machine-readable, authoritative source of
FACT/EVIDENCE/ASSUMPTION/HYPOTHESIS/DECISION for a product
(`governance/EVIDENCE_DISCIPLINE.md`, `governance/WORK_STATE_BOUNDARY.md`).
`docs/PRD.md` is a **human-readable narrative view derived from it** — never
a second place where a new fact is first recorded. A finding discovered
while writing or reviewing a PRD goes into `context.json` first, through the
normal write path; the PRD is updated afterward to reflect it.

State this relationship explicitly at the top of every PRD:

> Canonical source: this document is a narrative view of the product's
> Product Context (`context.json`, path per the product's registry entry).
> If the two disagree, Product Context is authoritative. Real history is
> `git log`, not a hand-maintained changelog.

## Method — the shared skeleton
1. **Header** — the canonical-source statement above, plus a supersede note
   if this PRD replaces a prior document (a Google Doc, an older spec).
2. **Product overview** — one paragraph: what the product is, for whom.
3. **Positioning** — where it sits relative to competitors/alternatives, if
   established; mark as ASSUMPTION where it isn't.
4. **Scope (current)** — what the product does today. Every claim cites its
   source: a ClickUp ticket, an IFU/regulatory document, or a `context.json`
   entry — never asserted from memory. Use this repo's own
   FACT/EVIDENCE/ASSUMPTION/HYPOTHESIS vocabulary; do not mix in an imported
   skill's own tagging scheme (e.g. the `prd-development` skill's 🔶/🔵
   markers) — one evidence vocabulary per repo.
5. **Out of scope / deferred** — explicit non-goals and known-deferred items,
   each with why, not just what.
6. **Open items** — must be items that already exist in `context.json`'s
   `evidence`/`decisions`, linked from there — not introduced here for the
   first time.
7. **Superseded content** (only when migrating from a prior document) — a
   table of what the old document said, what changed, and why, so a reader
   who only knew the old version can find themselves.

## Per-product adaptation
- **A product with a real regulatory artifact** (IFU, 510(k)/TFDA filing
  draft): the IFU is authoritative for regulatory scope language; the PRD's
  Scope section cites it rather than restating it — `colon-biopsy-ai-app`'s
  existing pattern.
- **A brand-new product with almost no source material** (e.g. a thin
  handoff doc): don't force the full skeleton prematurely. A
  Scope/Open-items-only stub is enough until there's real Product Context to
  narrate — writing Positioning/competitive sections before that research
  exists just produces ASSUMPTION-labeled filler.
- **A product whose behavior partly reuses cross-product shared logic**
  (e.g. a threshold/QC policy not unique to one product): the PRD references
  the shared decision rather than restating it inline, and says where the
  shared logic actually lives.
- **A product with an existing PRD written against a different template**
  (e.g. the external `prd-development` skill's TAM/SAM/persona structure):
  re-derive it against this skeleton rather than layering the two — sections
  with nothing behind them in `context.json` (market sizing, personas not
  backed by evidence) get cut, not carried forward as decoration.

## Output
A `docs/PRD.md` that: states its own subordinate relationship to
`context.json`; uses one evidence vocabulary throughout; contains no claim
without a source; and stays short enough that current state isn't buried
under speculative future scope.

## Pitfalls
- Treating the PRD as a second authoritative source and letting it silently
  diverge from `context.json` after the next research finding.
- Mixing this repo's `EVIDENCE_DISCIPLINE.md` vocabulary with an imported
  skill's tagging scheme in the same document.
- Writing Positioning/competitive-analysis sections as filler when the
  underlying research doesn't exist yet — label the gap instead of
  fabricating content to fill the section.
- Introducing a new "Open item" directly in the PRD instead of first
  recording it in `context.json`.
