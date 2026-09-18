# aetherAI Organization Context

Organization-specific facts that stay true when the product changes because aetherAI (雲象科技) governs both, but are not universal PDM methodology. See `docs/proposals/organization-context-layer.md` in `harrishhc/ai-product-organization` (approved by HH 2026-09-16) for the full design and boundary test.

## Boundary

- `org-context.json` — the canonical machine-readable entry point. Bounded sections: `delivery_process`, `roles`, `artifact_conventions`, `reporting_obligations`, `systems_of_record`, `stakeholders`.
- `knowledge/` — supporting source material, when a statement needs more than a one-line citation can carry. Not yet populated.

## What belongs here vs. a product's own Product Context

Boundary test: replace one aetherAI product with another. If the statement remains true, it belongs here. If it stops being true, it belongs in that product's own `context.json`.

Product-specific stakeholders (a named KOL, a clinical advisor tied to one product's validation work, a country-specific business contact) do **not** belong here even though they are "people at aetherAI's counterparties" — they belong in the specific product's own Product Context. Only genuinely cross-product roles (CEO, HH's manager, CEO's EA, the RA team as a function) are recorded here.

## Provenance caution

Everything in `org-context.json` is currently classified `EVIDENCE` or `ASSUMPTION`, sourced from a single HH conversation (2026-09-14) relayed through PDM's own memory system — not yet independently cross-checked against ClickUp, Google Drive, or Google Calendar directly. Treat it as a strong starting point for orientation, not as settled fact, until verified against the live systems it describes.

## Governance

This repository is descriptive context, not an authority layer above HH. It must never override `PDM_CONSTITUTION.md` or Founder authority. A proposed organization-wide policy change is a Founder decision, escalated per the Authority Matrix — never silently written here because PDM inferred a new norm from one product's behavior.
