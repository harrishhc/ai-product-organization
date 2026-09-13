# Collaboration Protocol: HH ↔ PDM Across Providers

This is PDM Evolution content (`docs/ARCHITECTURE.md` §8: "improving the PDM system itself, not managing a particular product") — it describes how HH works with PDM, not any product's strategy or roadmap. It lives here, not in a Product Registry entry: routing it through `runtime/decisionRecord.js`/`portfolio.js` would force a governance decision through plumbing built for product decisions, which is exactly the kind of cross-contamination `docs/ARCHITECTURE.md` §6 exists to prevent, just in the opposite direction.

## Current operating model (v1): HH drives the loop, by hand

There is no automated scheduler. HH opens whichever coding-agent CLI has usage available (Claude Code, Codex CLI, or any other [AGENTS.md](https://agents.md)-aware tool), asks PDM to continue, and works until the session ends or usage runs out — then opens a different tool and continues. This is deliberately simple: prove manual cross-provider handoff works before building anything that automates "who drives the loop." An automated driver (cron, systemd, or otherwise) is future work, not this version.

This works today because nothing PDM needs lives in any model's conversation memory — it's git state, readable by any tool:

```
AGENTS.md (repo root)
        ↓
governance/*.md — PDM identity, rules, this protocol
        ↓
portfolio-index.md — derived, one row per active product, regenerate before reading if stale
        ↓
selected product's active-brief.md (via bin/pdm-git.mjs sync <product>)
        ↓
do the work
```

## Starting a session, in any tool

Kickoff prompt (same wording works in Claude Code, Codex CLI, or any AGENTS.md-aware tool — the tool name is never part of the instruction):

> Read AGENTS.md, then check `portfolio-index.md` for the next runnable product. Sync it (`bin/pdm-git.mjs sync <productId>`), read its Active Brief, and continue from there.

If `portfolio-index.md` is stale or missing, regenerate it first (`refreshPortfolio()` + `renderPortfolioIndex()` + `writePortfolioIndex()` in `runtime/portfolio.js`) rather than trusting an old snapshot.

## Ending a session, or switching tools, or running out of usage

Before stopping, whichever tool is running must leave the repo in a state any other tool can pick up cleanly:

1. If a Founder checkpoint was raised (a recommendation now awaiting HH), it must already be persisted (`upsertDecisionRecord` + `publishProductRepositoryChanges`) — never left only in the conversation. See `governance/WORK_STATE_BOUNDARY.md`.
2. Update the product's `work-state.json` to reflect what actually got done.
3. Regenerate `portfolio-index.md` so the next session (any tool) sees current state without re-deriving it.
4. Commit and push whatever changed in `ai-product-organization` itself (portfolio-index.md, any governance changes).

A session that stops mid-work without doing this is the one failure mode that breaks cross-provider handoff: the next tool would have no way to know work was in progress.

## Attribution

Whichever tool/model is acting uses its own correct attribution in commit messages and PR descriptions — this is provided per-session by the harness (e.g. this repo's commits have carried `Co-Authored-By: Claude Opus 5`, `Claude Sonnet 5`, etc. depending on which model was active). Nothing in `runtime/` or governance encodes a specific model's identity; none of it is provider-specific.

## What this version deliberately does not do

- No automated loop driver (cron/systemd invoking a CLI on a schedule) — that requires deciding which persistent host runs it and is separate work, once manual handoff is validated.
- No model/task routing ("use a cheap model for simple work") — logged as a future nice-to-have, not built.
- Reusing `agent-seed`'s hosting is **not** assumed. `agent-seed` is a tag-activated Slack Q&A bot for answering colleague questions from a topic's accumulated knowledge (confirmed against its PRD) — a different problem (reactive knowledge lookup) from an autonomous work loop (proactive portfolio execution). If a persistent host is needed later for an automated driver, evaluate it on its own terms rather than assuming agent-seed's pattern transfers.
