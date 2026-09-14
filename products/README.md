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

## Current real products

The active portfolio currently contains four real products:

- `colon-biopsy-ai-app` — already migrated to its own repository and registered
  as `git_remote`.
- `ocr-slide-label-reader` — currently staged locally; migrate to its own repo.
- `prostate-biopsy` — currently staged locally; migrate to its own repo.
- `slide-quality-control` — currently staged locally; migrate to its own repo.

The staging directories are not a second source of truth after migration. They
exist only so the portfolio can be bootstrapped before a product-owned
repository is available.

PDM Core must contain no product-specific assumptions — see
[`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) §6. When PDM works on a
product, the effective working context is: PDM Core + the selected Product
Context, resolved on demand via:

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
