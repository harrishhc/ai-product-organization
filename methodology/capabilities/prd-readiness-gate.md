---
id: prd-readiness-gate
type: component
source: hh-original
version: 0.1.0
---

# PRD Readiness Gate

## Purpose
Gate the transition to a formal PRD or an Engineering delegation, per
`governance/PDM_CONSTITUTION.md` question 8 — "When may it call Engineering?
When the problem is clear, the solution is sufficiently chosen, and acceptance
criteria are actionable." A PRD is an execution contract, not a substitute for
unresolved discovery.

## When to use
See `selection_cues` / `anti_cues` in the registry entry. This is typically
the last capability invoked before Engineering delegation.

## Method
Check, explicitly:
1. Is the problem sufficiently clear (see `problem-framing-canvas` output)?
2. Is the proposed outcome meaningful and tied to the problem?
3. Are the key unknowns addressed, or intentionally and explicitly accepted?
4. Is a solution direction actually selected (not still "several options")?
5. Are acceptance criteria concrete and testable?

If any check fails: return "not ready" with the specific blocking gap(s), not
a partial PRD.

## Output
- Go / no-go on PRD transition.
- If no-go: the specific blocking gap(s), phrased so they are directly
  actionable (e.g. "no acceptance criteria for edge case X", not "needs more
  clarity").

## Pitfalls
- Approving a PRD to unblock Engineering under schedule pressure despite
  unresolved discovery.
- Treating "we discussed it a lot" as equivalent to "acceptance criteria are
  actionable."
