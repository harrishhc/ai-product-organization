# Organizations

This directory holds **test fixtures only** — the same role `products/_template/` plays for Product Context. It is not where real Organization Context lives.

Real Organization Context belongs in a dedicated repository owned by HH (see `docs/proposals/organization-context-layer.md`, approved 2026-09-16), resolved via the `organizations` map in `products/registry.json` — e.g. `aetherai` resolves to `harrishhc/aetherai-organization-context`, a `git_remote` repository, not a folder in this repo.

`_org-fixture/` exists so `runtime/organizationContext.js` and its tests have something real to resolve during development, exactly as `products/_template/` does for Product Context. Do not add real organization facts here.
