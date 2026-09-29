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

Directories that survived this filter were imported whole rather than
sampled. Only `prompt-generators/` and `storytelling/` were diffed against the
pinned Prompts commit; an earlier version of this paragraph claimed that check
covered every surviving directory ("byte-complete… file for file"), which the
record does not support, so treat the other directories as imported whole but
not individually verified. This was a content-type exclusion, not a size or
token constraint. Current file counts, for scale: 24 under
`methodology/prompts/market-intelligence/` and 39 under
`methodology/prompts/prompts/` (a nested directory that is itself named
`prompts`, which is why the bare "39 under `prompts/`" was ambiguous).

The prompt ecosystem is namespaced under `methodology/prompts/` to preserve
both source ecosystems without overwriting files with the same names — the
Prompts source has its own internal `skills/` subdirectory (a small, separate
collection following the Agent Skills standard), which without namespacing
would collide with `methodology/skills/` from the first source. See
`registry/ecosystem.json` for the resulting `prompts:skills:...` ids.

**Open item, found 2026-09-24, not yet decided:** the Skills source also has
a `research/` directory. It was described here as long-form essays plus a
Substack-post archive (`.zip`); that description was written without the
directory in this checkout to compare against and has not been re-verified,
so re-inspect the upstream `research/` before deciding. Unlike `prompting-style-guide.md`
(imported separately the same day — it was a plain sibling of three
already-imported guidance docs), this doesn't fit the pattern of anything
else this baseline indexes, and importing a `.zip` archive has no precedent
here. Not imported pending a content-curation call, the same kind `resumes-
resignations-reactions/` above already got.
