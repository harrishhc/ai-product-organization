# Products

Product Context is **product-owned**, not centrally copied into this repo.
Each real product should have its own repository. This directory holds only:

- `registry.json` — the **Product Registry**: a small pointer index mapping a
  product id to where its repository lives, where its context entry file is
  within that repository, portfolio policy (`priority` / `status`), and small
  metadata. It is metadata about products, not product content, so it belongs
  in PDM Core.
- `_template/` and other `_*/` directories — local fixtures for development
  and tests.
- product bootstrap directories such as `ocr-slide-label-reader/`,
  `prostate-biopsy/`, and `slide-quality-control/` are **temporary migration
  staging areas**, not the intended long-term home of real Product Context.
  Once a product has its own repository, its Product Context and Work State
  must move there and the registry entry should become `git_remote`.
- `pdm-core/` is the one permanent exception to that rule — see below.

## Current real products

The active portfolio contains the customer-facing products below plus PDM Core
itself:

- `colon-biopsy-ai-app` — already migrated to its own repository and registered
  as `git_remote`.
- `ocr-slide-label-reader`, `prostate-biopsy`, `slide-quality-control` — each
  registered as `git_remote`, cloned under `.product-clones/`.
- `pdm-core` — PDM Core managed as a product. Its repository **is** this
  repository (`local_path` at `.`), so unlike the three above it is not a separate
  clone and must never be moved out: there is nowhere to move it to. `priority: 4` is deliberate — below every real product, so portfolio
  selection never ranks PDM Core ahead of a READY customer-facing product.
  Only READY products are ranked, so when no real product is READY (waiting on
  HH, blocked, idle, or not cloned on this machine), PDM Core is the next work —
  intended, and consistent with "one product waiting must not stop the others". The ordering is a registry convention, not test-enforced.

A `git_remote` product's clone under `.product-clones/` is a working copy, not
a second source of truth: the product's own repository owns its Product Context
and Work State.

### Why registering PDM Core does not violate §6

[`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) §6 requires that PDM Core
contain no product-specific assumptions. `pdm-core/` satisfies it the same way
every other product does: its context and Work State are product content under
`products/`, and nothing in `methodology/` or `runtime/` reads them or is
allowed to. The registry treats it as one product among the others.

The genuine risk is §6's other half — *"the existence of one product must not
cause its conclusions to become universal PDM rules."* That failure mode is
more tempting for PDM Core than for any other product, because this product's
context file and the methodology it is about live in the same repository, so
promoting a finding takes one commit instead of a deliberate decision. It is
still a promotion, and it still needs the same bar: a finding recorded in
`products/pdm-core/context.json` is that product's observation, not a rule.
Turning it into a rule means changing `AGENTS.md`, `governance/`, or
`docs/ARCHITECTURE.md` on its own merits, argued as a contract change.

When PDM works on a product, the effective working context is: PDM Core + the
selected Product Context, resolved on demand via:

```
PDM -> Product Registry -> identify selected product -> resolve product
  repository -> retrieve only relevant/bounded Product Context
  -> optionally write/update product artifacts when authorized
```

See [`runtime/productRegistry.js`](../runtime/productRegistry.js) (resolution),
[`runtime/context.js`](../runtime/context.js) (bounded retrieval, and
`writeProductContext` for the explicit, never-automatic write-back), and
[`runtime/productSync.js`](../runtime/productSync.js) for git-remote sync/publish.
PDM never scans every registered product, and never preloads a product's full
context — only the specific product id and sections a task needs.

## Repository migration invariant

When a staged product receives a real repository:

1. create the product repository;
2. seed it with the staged Product Context / Work State and the standard product
   agent/governance bootstrap files appropriate to that repository;
3. verify the product repo is independently readable and writable;
4. change that product's registry entry from `local_path` to `git_remote` only
   after the remote is usable;
5. remove the staging copy from PDM Core only after the remote copy is verified,
   so no product context is lost during migration.

Creating/deleting repositories is a Founder-authorized action under
`governance/AUTONOMY_BOUNDARY.md`; once HH explicitly requests the migration,
PDM may execute the remaining bootstrap and registry work.
