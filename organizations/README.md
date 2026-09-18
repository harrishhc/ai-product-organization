# Organizations

This directory holds **test fixtures only** — the same role `products/_template/` plays for Product Context. It is not where real Organization Context lives.

Real Organization Context is resolved via the `organizations` map in `products/registry.json`, which supports both a `local_path` directory here and a `git_remote` repository. `aetherai` is a `local_path` organization at `organizations/aetherai/`; it needs no sync step. A separate repository is for the case where an organization's context must be access-isolated from PDM Core's own audience — see `docs/proposals/organization-context-layer.md` §4 for the choice rule and for why the aetherAI case was reversed on 2026-09-18.

`_org-fixture/` exists so `runtime/organizationContext.js` and its tests have something real to resolve during development, exactly as `products/_template/` does for Product Context. Do not add real organization facts here.
