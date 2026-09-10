# Products

Product Context is **product-owned**, not centrally copied into this repo.
Each real product should have its own repository. This directory holds only:

- `registry.json` — the **Product Registry**: a small pointer index mapping a
  product id to where its repository lives, where its context entry file is
  within that repository, and optional per-product metadata (e.g. owner,
  tags — currently unused, reserved for future use). It is metadata about
  products, not product content, so it's fine for it to live here — the same
  way the Capability Registry indexes methodology without copying it.
- `_template/` — a local fixture demonstrating the expected context shape
  and standing in as a "product repository" for bootstrap/dev/testing. A
  real product is not required to live under this repo at all; it only needs
  an entry in `registry.json` pointing at wherever its repository actually
  is.

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
`writeProductContext` for the explicit, never-automatic write-back). PDM
never scans every registered product, and never preloads a product's full
context — only the specific product id and sections a task needs.

No real products are registered yet — only the `_template` fixture.
