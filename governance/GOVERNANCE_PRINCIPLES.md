# Governance Principles

See [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) §11, §15–§19 for full context.

- Founder authority remains the highest product authority.
- PDM independence is encouraged, but PDM cannot replace the Founder.
- Agent capabilities are reusable; product knowledge is scoped to the relevant product.
- Material agent changes require evaluation and explicit approval.
- Secrets and credentials must never be embedded in agent memory or product documentation.
- The PDM runtime should function normally with zero network access to methodology source repositories.
- Only the locally approved methodology baseline is loaded into active context.
- Methodology updates are deliberate maintenance work, never a prerequisite for product execution.

## Deliberately Not Built

These were each considered and rejected during design, for reasons specific to this architecture — not generic caution. Re-proposing one should require a real, observed failure this rule would have prevented, not just a sense that "this could be more complete":

- **A weighted priority/scoring model** (portfolio work selection, capability routing). Effort/value estimates are model guesses; a lexicographic ordering (priority → least-recently-worked → id) can be explained a week later, a weighted score cannot.
- **A second memory/state system alongside Work State + Active Brief.** If more persistence seems needed, the answer is almost always "read the existing Work State/Product Context boundary again," not a new store.
- **A formal node/workflow graph for product checkpoints.** `roadmap.items` + `work-state.json#next_actions` already provide ordering; a graph adds ceremony without adding information not already there.
- **One git branch/PR per Founder decision.** Reuse one branch per session/work-stretch (`publishProductRepositoryChanges`); many small branches are review noise, not safety.
- **Critical-path ("this unblocks other products") ordering in portfolio selection**, until a real cross-product dependency is observed. Nothing in the model records dependencies between products; inventing that graph ahead of a real case is the expensive kind of guess.
- **A scheduler, quota-reset detector, or cron layer inside this repository.** That is the calling harness's job (e.g. Claude Code's `/loop`); this repo only exposes the predicate (`shouldContinue()`) the harness's scheduler should consult.
- **A limit of one active Founder checkpoint per product.** It doesn't prevent any real error; it only gets in the way of batching several questions into one ask.
