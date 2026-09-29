# Methodology Genesis

This directory is the HH-owned methodology baseline.

## Initial genetic sources

- Product Manager Skills: deanpeters/Product-Manager-Skills @ 1b5a524ebb95e9497fa3f25002d8b8ec528d4444
- Product Manager Prompts: deanpeters/product-manager-prompts @ c3b91dba8f7782fac72c7aa340b98d6554b1f3ec

These snapshots are the initial seed only. HH's repository is the runtime
source of truth after import. External repositories are not runtime
dependencies and are not consulted during ordinary product work.

**What "exclude repository/application tooling" actually meant, verified
2026-09-24 against both pinned upstream commits** (this sentence previously
had unfilled template blanks; rather than guess the original wording, the
exclusion is stated here from a direct diff against each upstream repository
at its pinned commit, not reconstructed from memory):

- Each source's own agent contract and provider adapters (`AGENTS.md`,
  `CLAUDE.md`) — this repository has its own, and importing a second would
  collide and confuse rather than help. Both sources have these.
- Each source's own CLI tooling for browsing/invoking its content
  (`scripts/`) — superseded here by `runtime/orchestrator.js#selectCapability`
  and `bin/pdm-run.mjs`, which route the full imported corpus rather than a
  keyword-grep subset. Both sources have a `scripts/` directory for this.
- Each source's own per-tool setup guides, onboarding docs, and release
  packaging (`docs/`, `app/`, `dist/` — Skills source only) — these document
  how to use *that* repository's own release process, not reusable
  methodology.
- Each source's own project/development bookkeeping — dated dev logs,
  planning, and contribution docs. Different per source: the Skills source
  has `CONTRIBUTING.md`, `MARKETPLACE_STRATEGY.md`, `PLANS.md`,
  `.claude-plugin/`, and a set of dated log files (`04JUL26.md` etc.); the
  Prompts source has `SUBMISSIONS-GUIDE.md`, `COUPLING-REMEDIATION-PLAN.md`,
  and `SESSION-SUMMARY-*.md`.
- CI machinery (`.github/` — both sources).
- From the Prompts source only, `resumes-resignations-reactions/` — content
  the upstream README itself labels "therapeutic workplace satire," not
  methodology (confirmed with HH 2026-09-24: leave excluded).

Directories that survived this filter were meant to be imported whole rather
than sampled. The record shows only `prompt-generators/` and `storytelling/`
being diffed against the pinned Prompts commit; an earlier version of this
paragraph claimed that check covered every surviving directory
("byte-complete… file for file"), which nothing supports, so treat the other
directories as intended-whole but not individually verified. This was a
content-type exclusion, not a size or token constraint. Current file counts,
for scale: 24 under `methodology/prompts/market-intelligence/` and 39 under
`methodology/prompts/prompts/` (a nested directory that is itself named
`prompts`, which is why the bare "39 under `prompts/`" was ambiguous).

The prompt ecosystem is namespaced under `methodology/prompts/` to preserve
both source ecosystems without overwriting files with the same names — the
Prompts source has its own internal `skills/` subdirectory (a small, separate
collection following the Agent Skills standard), which without namespacing
would collide with `methodology/skills/` from the first source. See
`registry/ecosystem.json` for the resulting `prompts:skills:...` ids.

**Decided 2026-09-29, not imported:** the Skills source also has a `research/`
directory (long-form essays and a Substack-post archive `.zip`). HH's call:
it is the upstream author's own earlier research records, not methodology, so
it is left out and no longer an open item — the same kind of content-type
exclusion `resumes-resignations-reactions/` above got. This file records the
reason so the question is not reopened by the absence.

One consequence to know about: `research/finance/` is the source material that
seven imported skills cite under "Adapted from" —
`acquisition-channel-advisor`, `business-health-diagnostic`,
`feature-investment-advisor`, `finance-based-pricing-advisor`,
`finance-metrics-quickref`, `saas-economics-efficiency-metrics` and
`saas-revenue-growth-metrics`. Those citations dangle by design: they are
attribution lines at the foot of each skill, not paths the runtime resolves. Reconsider only if a concrete failure case needs
something in `research/`, including one of those seven citations.
