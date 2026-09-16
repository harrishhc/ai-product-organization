# Collaboration Protocol: HH ↔ PDM Across Providers

This is PDM Evolution content (`docs/ARCHITECTURE.md` §8: improving the PDM system itself, not managing a particular product). It describes how HH works with PDM. It does not define a product strategy or roadmap.

## Operating model: PDM Worker, not a one-shot prompt

PDM is a long-lived product-management role responsible for the active portfolio, not a single product and not a sequence of unrelated chat sessions.

A **host** (for example Claude Code or Codex running in a persistent `tmux` session) provides the process, filesystem, tools, and conversation channel. The host must be started/resumed in the intended PDM Core working directory. The PDM role itself comes from the repository contract; it does not depend on one provider's chat memory.

The worker repeatedly follows this loop:

```text
load portfolio state
        ↓
select next runnable work
        ↓
sync selected product if needed
        ↓
read that product's Active Brief
        ↓
select the smallest sufficient methodology capability
for that product's dominant uncertainty
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

A worker may therefore move through `A → B → C` without HH restarting it simply because A reached a Founder checkpoint.

## Provider bootstrap and working directory

Provider-neutral instructions live in root `AGENTS.md`, but providers discover them differently.

Codex uses `AGENTS.md` as repository instructions. Claude Code uses `CLAUDE.md` as its automatic project memory/bootstrap file; this repository's root `CLAUDE.md` is intentionally a thin adapter that points to `AGENTS.md`.

**The worker should be started from the PDM Core repository root.** A `cd` issued inside a later Bash/tool call may affect only that shell invocation and does not retroactively establish the agent process's startup context. Hosts that create a fresh shell per tool call must use their process/session startup configuration to set the repository root.

Human setup details live in [`docs/GETTING_STARTED.md`](../docs/GETTING_STARTED.md).

## Interaction modes

Dean's existing interaction modes remain the methodology baseline; this protocol does not create competing modes.

- **Facilitation** and **Checkpointed co-construction** are the interactive modes: HH can join the running worker, discuss the current product, challenge a recommendation, or make a Founder decision. The worker then resumes from durable state.
- **Autonomous investigation** is the unattended mode: the worker continues through runnable work, persists checkpoints, skips products waiting on HH, and keeps using the remaining portfolio budget instead of waiting for a human response.

Interaction mode is execution policy, not a different PDM identity, memory system, or product state model.

## Founder checkpoints: decision artifact first, PR second

A Founder checkpoint is not complete merely because the decision was persisted in `context.json`. A PDM recommendation must be turned into a **human-readable Founder Decision Brief** before the worker asks HH to decide.

**The review-surface rule below (inline content + remote link, never a local path alone) is not specific to Founder checkpoints — see `governance/AUTONOMY_BOUNDARY.md` §4.** It applies to any artifact PDM produces for HH: a proposal, an analysis, a corrected document, this brief.

The Founder Decision Brief is the primary interaction surface. It should be a concise Markdown artifact stored in the affected product repository, under the product's documented review/artifact location. The artifact should contain, at minimum:

- the decision to make and why it matters now;
- the PDM recommendation;
- the strongest supporting evidence with source references;
- the main alternatives considered;
- material risks / opportunity costs;
- what changes depending on each option;
- the exact question HH must answer.

After creating the brief, the worker must **surface it where HH actually is** — frequently a remote `tmux` session on a machine that does not hold this repository. Surfacing therefore means both of:

1. **the decision content inline in the terminal** — question, recommendation, strongest evidence, options, and what changes per option, written out in the response body itself; and
2. **a remotely reachable link** — the PR, or the file's URL on the forge.

A local absolute path is **not** a review surface: HH cannot open it from a remote session. A path may accompany the two required forms; it may never replace them.

A GitHub branch and PR may be used as the collaboration/review transport when product publication rules call for them. The PR is useful, but it is **not** the sole Founder review surface and should never be presented as a mandatory extra step for HH. If opening a PR is part of the repository workflow and the host permits it, the worker should create it as part of publishing; otherwise the durable Markdown brief and terminal presentation remain sufficient.

The intended human flow is:

```text
PDM reaches decision boundary
        ↓
persist recommendation / pending decision
        ↓
write Founder Decision Brief
        ↓
publish durable product state
        ↓
surface brief in tmux
        ↓
HH reviews + decides
        ↓
PDM records Founder decision
        ↓
resume normal portfolio loop
```

A Founder Decision Brief is decision-specific and disposable as a presentation artifact; the underlying decision record and product context remain the source of truth.

## Host vs PDM responsibility

The boundary is deliberate:

```text
Host (tmux / CLI / later systemd, cron, etc.)
    └── starts/resumes the process, keeps it alive, provides tools and usage

PDM Worker
    ├── owns portfolio-level work selection
    ├── owns product-management reasoning and methodology selection
    ├── respects Founder checkpoints
    ├── persists durable state
    ├── prepares human-readable Founder Decision Briefs
    └── decides when there is no runnable work

Runtime Governor
    └── decides whether another work unit may start
```

The PDM Worker must not assume that the model provider's conversation memory is durable. Git-backed Product Context, Work State, Active Brief, decision records, portfolio state, and human-readable Founder Decision Briefs are the durable source of continuity/review.

The PDM Worker must not own provider-specific quota/reset logic. The host supplies the actual usage signal through the Runtime Governor boundary. Quota-reset detection and wake-up scheduling remain host concerns.

## Context hygiene: keep the persistent session for portfolio work, not one-off work

The worker's context window is not durable state but it is a scarce resource across a long-lived session: it accumulates for as long as the host process runs, and the host will eventually summarize/compact older turns to keep going. A long-lived session that also absorbs every incidental lookup degrades in two ways as it grows — recall of older, buried detail gets less reliable even before compaction, and compaction itself is lossy. Since PDM's actual continuity lives in Product Context / Work State / Active Brief / decision records (not in the conversation), there is no reason to spend the persistent session's context on work whose output does not need to persist there.

**Rule:** a task that is one-off, investigative, or exploratory — and whose raw output the worker will not need again once it has the answer — should run in a disposable subagent (or equivalent host-provided isolated task), not inline in the persistent worker session. Examples: a broad grep/log sweep, a one-time external lookup, drafting an artifact whose intermediate attempts don't need to be kept, checking a hypothesis that turns out to be a dead end. The worker keeps only the synthesized result in its own context; the exploration noise stays in the subagent.

This is distinct from `DELEGATION_LOGIC.md`, which routes product-domain uncertainty to Research/Design/QA/Engineering specialists. Context hygiene is an execution-tooling concern — which host mechanism runs a task — not a product-management delegation decision, and it applies even to work the PDM role itself would normally do directly.

This is a "proceed without asking" action under `AUTONOMY_BOUNDARY.md` §1: choosing to isolate a one-off task in a subagent is never a checkpoint. It also does not change what gets persisted — a subagent's findings that qualify as product fact/evidence/decision still go into Product Context via the normal write path; a subagent is a scratchpad, not a second source of truth.

## Starting a worker

The repository's provider adapter and `AGENTS.md` establish the operating contract. The human should normally start the host from the repo root rather than repeatedly re-typing a kickoff prompt.

Recommended shell startup:

```bash
cd ~/workspace/ai-product-organization
claude
```

or:

```bash
cd ~/workspace/ai-product-organization
codex
```

After startup, a short role-setting prompt is useful for a fresh model process:

> You are the HH PDM Worker. Use the repository's AGENTS.md and governance as the authoritative operating contract. Start from the current portfolio state, select the next runnable work, and continue the portfolio loop. Follow the autonomy and collaboration boundaries. When HH must review something, surface enough content inline and provide a remotely reachable link.

This is a role bootstrap, not a replacement for the repository instructions. It should not prescribe a fixed file-reading script or a single product.

## Cross-provider handoff

All supported providers read the same durable state. Switching from Claude Code to Codex, or restarting after a host interruption, does not create a new product-management identity; it resumes the same PDM Worker role from Git-backed state.

The compact continuity path is:

```text
provider bootstrap adapter
        ↓
AGENTS.md
        ↓
portfolio state
        ↓
selected product Work State / Active Brief
        ↓
bounded Product Context / Organization Context as needed
        ↓
do the work
        ↓
persist durable state
```

A fresh worker must not need the previous chat transcript to reconstruct continuity. Durable repository state takes precedence over conversational claims.

## Ending, pausing, or resuming

When the worker is about to stop because the host is ending, the usage budget is exhausted, or HH explicitly pauses it, it must leave durable state usable by another worker:

1. Persist any Founder checkpoint that was raised; never leave it only in the conversation.
2. Create/update the affected product's Founder Decision Brief when a decision requires HH review.
3. Update the affected product's `work-state.json` to reflect what actually happened.
4. Regenerate `portfolio-index.md` when product state changed enough to affect selection/status.
5. Commit and push changes in `ai-product-organization` itself when required by the repository workflow.

A host restart is therefore a resume operation, not a request to reconstruct the product from scratch.

## Deliberately not built yet

- No provider-specific scheduler or quota-reset daemon lives inside PDM Core. A host such as `tmux` is the current persistence mechanism; a later host can add scheduling without changing PDM's product state model.
- No model/task routing such as "use a cheap model for simple work".
- No second memory system. Product Context, Work State, Active Brief, decision records, portfolio state, and Founder Decision Briefs remain the state/review model.
- No cross-product dependency graph until a real product dependency exists.
- No requirement for a PR on every product decision. A PR can be transport when useful; the Founder Decision Brief + terminal presentation are the human interaction surface.

## Attribution

Whichever tool/model is acting uses accurate provider/model attribution in commit messages and PR descriptions. Nothing in PDM Core should encode a specific model's identity.
