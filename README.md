# AI Product Organization

A reusable, continuously-evolving AI Product Organization: HH acts as Founder / CEO, PDM acts as Senior Product Director, and Research / Design / QA / Engineering are reusable functional agents across products. Products iterate continuously; agent capabilities improve through an independent evolution system.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full architecture record (v0.3).

## Core Principle

Capabilities are reusable. Context is product-specific. Products continuously evolve. Agents continuously improve. Governance prevents cross-contamination.

## Layout

```
agents/          reusable functional capabilities (cross-product)
  pdm/           Senior Product Director role
  research/      Research agent
  design/        Design agent
  qa/            QA agent
  engineering/   Engineering / Coding agent
  evolution/     PDM Evolution Agent (independent evolution plane)
runtime/         executable PDM Core: identity/governance, capability
                 registry+resolver, Product Registry resolver (local_path and
                 git_remote products), Product Sync (deliberate, HH-gated
                 clone/pull AND publish — commit+push a new branch back to a
                 git_remote product's own repository; never opens a PR
                 itself), Product Context boundary, Work State + Active
                 Brief boundary, orchestrator, decision-state model,
                 instrumentation, methodology-evolution boundary (see
                 runtime/*.js)
methodology/     HH-owned methodology baseline (operational source of truth)
  registry/      compact capability metadata (registry.json, 7 capabilities)
  capabilities/  detailed capability instructions, lazily loaded
  provenance/    provenance records for adopted external material
vendor/          pinned, one-time seed import of external methodology
                 (4 skills from Dean Peters' Product Manager Skills, see
                 vendor/dean-product-manager-skills/PROVENANCE.md) — not a
                 live dependency; runtime never reads this directory
products/        Product Registry only (registry.json) — a pointer index to
                 each product's OWN repository, never a copy of its content
  registry.json  maps product id -> repository location (local_path or
                 git_remote) + context entry + work-state entry + metadata.
                 git_remote products (e.g. colon-biopsy-ai-app) resolve to a
                 gitignored local clone under .product-clones/, created/kept
                 in sync only by an explicit runtime/productSync.js call —
                 never automatically during ordinary product work
  _template/     local fixture standing in as a "product repository" for
                 bootstrap/dev/testing
governance/      role boundaries, decision model, delegation logic, governance principles
docs/            architecture records
tests/           node:test suite covering behavior + architectural invariants
```

## Status

v0.3 architectural record, with a working runtime bootstrap (`runtime/` +
`tests/`, plain Node.js, zero npm dependencies — see `npm test`) and an
initial methodology seed imported from Dean Peters' Product Manager Skills
(4 of ~70+ skills, pinned to one commit; see `methodology/README.md`).
Subordinate specialist-agent implementations (Research/Design/QA/Engineering)
and a real (non-template) Product Context are still open — see
`docs/ARCHITECTURE.md` and the per-directory READMEs for what's decided vs.
still pending HH approval.
