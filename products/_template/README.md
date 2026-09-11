# Product Context template

`context.json` shape mirrors the conceptual interface in the Runtime
Architecture spec §9: strategy, users, evidence, decisions, experiments,
roadmap.

`work-state.json` is a separate, optional fixture (registered via
`work_state_entry` in `../registry.json`) for PDM's own operational memory —
see [`../../governance/WORK_STATE_BOUNDARY.md`](../../governance/WORK_STATE_BOUNDARY.md)
for why it is kept distinct from `context.json`. `active-brief.md` is never
checked in here: it is disposable, derived output (`renderActiveBrief()` in
`runtime/workState.js`), regenerated on demand rather than committed as a
fixture.

This directory is a **local fixture**, not "where product context lives."
Product Context is product-owned: a real product should have its own
repository (which may live anywhere — it does not need to be nested in this
repo). To onboard one, add an entry to
[`../registry.json`](../registry.json) (the Product Registry) pointing at
that repository's location and its context-entry file; `runtime/context.js`
resolves and reads it from there. This `_template/` folder exists only so
the registry has something real to resolve during bootstrap/dev/testing.

Do not add product-specific facts to `governance/`, `methodology/`, or
`runtime/`. Product Context belongs in the product's own repository, per the
PDM Constitution §12 boundary — this repo stores only the Product Registry
pointer, never the content itself.
