# Collaboration Protocol: HH ↔ PDM Across Providers

This is PDM Evolution content (`docs/ARCHITECTURE.md` §8: "improving the PDM system itself, not managing a particular product") — it describes how HH works with PDM, not any product's strategy or roadmap. It lives here, not in a Product Registry entry: routing it through `runtime/decisionRecord.js`/`portfolio.js` would force a governance decision through plumbing built for product decisions, which is exactly the kind of cross-contamination `docs/ARCHITECTURE.md` §6 exists to prevent, just in the opposite direction.

## Operating model: PDM Worker, not a one-shot prompt

PDM is a long-lived product-management worker responsible for the entire active portfolio, not a single product and not a sequence of unrelated chat sessions.

A host process (for example a persistent Claude Code or Codex CLI process inside `tmux`) keeps the worker alive. The host is infrastructure; PDM remains the same role and uses the same portfolio/product state whether HH is actively chatting with it or leaves it running unattended.

The worker repeatedly follows this loop:

```
load portfolio state
        ↓
select next runnable work
        ↓
sync selected product if needed
        ↓
read that product's Active Brief
        ↓
do one coherent work unit
        ↓
persist durable state / evidence / checkpoint as required
        ↓
refresh portfolio state
        ↓
select the next runnable work
        ↓
repeat
```

A product reaching `WAITING_FOR_FOUNDER` is a **product-local stop**, never a global stop. The worker must continue with another runnable product while HH is unavailable, unless a global stop condition applies.

The worker stops only when one of these conditions is true:

- no runnable work remains across the active portfolio;
- the Runtime Governor says work may not continue;
- a global policy / safety boundary requires stopping;
- HH explicitly asks the worker to stop.

This means a long-lived worker may move through `A → B → C` without HH restarting it simply because A reached a Founder checkpoint.

## Interaction modes

Dean's existing interaction modes remain the methodology baseline; this protocol does not create competing modes.

- **Facilitation** and **Checkpointed co-construction** are the interactive modes: HH can join the running worker, discuss the current product, challenge a recommendation, or make a Founder decision. The worker then resumes from durable state.
- **Autonomous investigation** is the unattended mode: the worker continues through runnable work, persists checkpoints, skips products waiting on HH, and keeps using the remaining portfolio budget instead of waiting for a human response.

Interaction mode is execution policy, not a different PDM identity, memory system, or product state model.

## Host vs PDM responsibility

The boundary is deliberate:

```
Host (tmux / CLI / later systemd, cron, etc.)
    └── keeps the process alive, starts/resumes it, provides tools and usage

PDM Worker
    ├── owns portfolio-level work selection
    ├── owns product-management reasoning and methodology selection
    ├── respects Founder checkpoints
    ├── persists durable state
    └── decides when there is no runnable work

Runtime Governor
    └── decides whether another work unit may start
```

The PDM Worker must not assume that the model provider's conversation memory is durable. Git-backed Product Context, Work State, Active Brief, decision records, and portfolio state are the durable source of continuity.

The PDM Worker must not own provider-specific quota/reset logic. The host supplies the actual usage signal through the Runtime Governor boundary. Quota-reset detection and wake-up scheduling remain host concerns.

## Starting a worker

A kickoff prompt is still useful because it establishes that a fresh model process should enter **PDM Worker mode**. It is not a per-product command sequence and it should not tell the worker to stop after one product.

Use this prompt in Claude Code, Codex CLI, or another AGENTS.md-aware host:

> You are the HH PDM Worker. Read `AGENTS.md` and the PDM governance. Then operate as the long-lived PDM responsible for the entire active portfolio. Start from the current portfolio state, select the next runnable work, sync the selected product when needed, read its Active Brief, and do the highest-value coherent work unit you can safely complete. After each work unit, persist the correct durable state and immediately re-evaluate the portfolio for the next runnable work. A product waiting for Founder input does not stop the worker; continue on another runnable product. In autonomous mode, persist Founder checkpoints and move on rather than waiting for a response. Stop only when there is no runnable work, the Runtime Governor says you cannot continue, a global policy/safety boundary requires stopping, or HH explicitly tells you to stop.

The prompt intentionally does **not** prescribe a fixed file-reading sequence beyond the repository's governance. The worker is expected to use the existing portfolio, Work State, Active Brief, bounded Product Context, methodology registry, and specialist delegation rules rather than mechanically replaying a script.

## Cross-provider handoff

All tools read the same durable state. Switching from Claude Code to Codex, or restarting after a host interruption, does not create a new product-management identity; it resumes the same PDM Worker role from git-backed state.

The compact bootstrap path is:

```
AGENTS.md
    ↓
portfolio state
    ↓
selected product Work State / Active Brief
    ↓
bounded Product Context as needed
    ↓
do the work
```

A fresh worker may inspect the portfolio state and selected product state before doing anything else. It must not load the full history of every product merely to reconstruct continuity.

## Ending, pausing, or resuming

When the worker is about to stop because the host is ending, the usage budget is exhausted, or HH explicitly pauses it, it must leave durable state usable by another worker:

1. Persist any Founder checkpoint that was raised; never leave it only in the conversation.
2. Update the affected product's `work-state.json` to reflect what actually happened.
3. Regenerate `portfolio-index.md` when product state changed enough to affect selection/status.
4. Commit and push changes in `ai-product-organization` itself when required by the repository workflow.

A host restart is therefore a resume operation, not a request to reconstruct the product from scratch.

## Deliberately not built yet

- No provider-specific scheduler or quota-reset daemon lives inside PDM Core. A host such as `tmux` is the simplest current persistence mechanism; a later host can add scheduling without changing PDM's product state model.
- No model/task routing ("use a cheap model for simple work") — logged as a future nice-to-have, not built.
- No second memory system. Product Context, Work State, Active Brief, decision records, and derived portfolio state remain the state model.
- No cross-product dependency graph until a real product dependency exists.
- No automatic pull-request creation for every product decision. Product decision persistence and publication are separate from the deliberate PR-opening step.

## Attribution

Whichever tool/model is acting uses its own correct attribution in commit messages and PR descriptions. Nothing in `runtime/` or governance encodes a specific model's identity; none of it is provider-specific.
