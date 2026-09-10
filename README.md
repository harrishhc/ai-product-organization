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
                 registry+resolver, Product Registry resolver, Product
                 Context boundary, orchestrator, decision-state model,
                 instrumentation, methodology-evolution boundary (see runtime/*.js)
methodology/     HH-owned methodology baseline (operational source of truth)
  registry/      compact capability metadata (registry.json)
  capabilities/  detailed capability instructions, lazily loaded
  provenance/    provenance records for any adopted external material
vendor/          reserved for a one-time/deliberate seed import of external
                 methodology (e.g. Dean Peters' skills/prompts) — empty until
                 HH decides to perform that import; not a live dependency
products/        Product Registry only (registry.json) — a pointer index to
                 each product's OWN repository, never a copy of its content
  registry.json  maps product id -> repository location + context entry
  _template/     local fixture standing in as a "product repository" for
                 bootstrap/dev/testing
governance/      role boundaries, decision model, delegation logic, governance principles
docs/            architecture records
tests/           node:test suite covering behavior + architectural invariants
```

## Status

v0.3 architectural record, with a working runtime bootstrap (`runtime/` +
`tests/`, plain Node.js, zero npm dependencies — see `npm test`). Subordinate
specialist-agent implementations (Research/Design/QA/Engineering), a real
Product Context, and any vendored external methodology are still open — see
`docs/ARCHITECTURE.md` and the per-directory READMEs for what's decided vs.
still pending HH approval.
