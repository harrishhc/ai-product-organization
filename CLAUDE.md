# Claude Code bootstrap

This repository uses `AGENTS.md` as the provider-neutral agent contract.

Claude Code automatically loads `CLAUDE.md` files at session startup. This file is intentionally tiny: it bootstraps Claude Code into the shared contract instead of duplicating the PDM rules here.

Read and follow [`AGENTS.md`](AGENTS.md) for the actual instructions, governance, architecture, workflow, and cross-provider portability rules.

For a human starting a new worker session, see [`docs/GETTING_STARTED.md`](docs/GETTING_STARTED.md).
