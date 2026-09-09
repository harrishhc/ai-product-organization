# Methodology

Vendored/pinned upstream methodology, versioned separately from PDM Core. See [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) §13, §15 for full context.

- Upstream methodology is a governed dependency, not a live runtime dependency.
- Only a locally approved, pinned snapshot is loaded into active context — no network access required at runtime.
- Evolution path: upstream change → diff → classify → validate → impact review → HH approval → vendor update → registry update → evaluation.

## Candidate upstream sources (not yet vendored)

- https://github.com/deanpeters/Product-Manager-Skills
- https://github.com/deanpeters/product-manager-prompts
