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
  collide and confuse rather than help.
- Each source's own CLI tooling for browsing/invoking its content
  (`scripts/`, e.g. `find-a-skill.sh`, `run-pm.sh`, `generate-catalog.py`) —
  superseded here by `runtime/orchestrator.js#selectCapability` and
  `bin/pdm-run.mjs`, which route the full imported corpus rather than a
  keyword-grep subset.
- Each source's own per-tool setup guides, onboarding docs, session logs,
  contribution/submission guides, and release packaging (`docs/`, `app/`,
  `dist/`, `SESSION-SUMMARY-*.md`, `SUBMISSIONS-GUIDE.md`,
  `COUPLING-REMEDIATION-PLAN.md`) — these document how to use *that*
  repository's own release process, not reusable methodology.
- CI machinery (`.github/`).
- From the Prompts source only, `resumes-resignations-reactions/` — content
  the upstream README itself labels "therapeutic workplace satire," not
  methodology (confirmed with HH 2026-09-24: leave excluded).

Every directory that survived this filter was imported byte-complete, not
partially — verified by diffing `prompt-generators/` and `storytelling/`
against the pinned Prompts commit, file for file. This was a content-type
exclusion, not a size or token constraint: no directory was truncated, and
some multi-file directories (24 files under `market-intelligence/`, 39 under
`prompts/`) came in whole.

The prompt ecosystem is namespaced under `methodology/prompts/` to preserve
both source ecosystems without overwriting files with the same names — the
Prompts source has its own internal `skills/` subdirectory (a small, separate
collection following the Agent Skills standard), which without namespacing
would collide with `methodology/skills/` from the first source. See
`registry/ecosystem.json` for the resulting `prompts:skills:...` ids.
