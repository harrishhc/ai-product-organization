---
id: problem-framing-canvas
type: component
source: hh-original
version: 0.1.0
---

# Problem Framing Canvas

## Purpose
Force an explicit statement of the user/business problem before any solution
is discussed. Prevents solution-leap (Constitution §5) and PRD-first behavior
(Specification §20).

## When to use
See `selection_cues` / `anti_cues` in the registry entry. Use this before
discovery, prioritization, or PRD work whenever the problem itself has not
been stated in falsifiable terms.

## Method
1. State the problem in one sentence, naming who has it and what happens if
   it is not solved.
2. List what is FACT, what is EVIDENCE, what is ASSUMPTION (Constitution §7)
   behind that statement.
3. Name the affected users/segment explicitly; do not default to "users" in
   general.
4. Identify what would falsify the problem statement (what evidence would
   show this isn't actually a problem worth solving).
5. Flag if a solution has already been proposed — separate the solution from
   the problem statement explicitly.

## Output
- One-sentence problem statement.
- Affected users.
- FACT / EVIDENCE / ASSUMPTION breakdown.
- Falsification condition.
- Evidence gaps (feed into `discovery-question-set` if material).

## Pitfalls
- Naming a solution ("we need a dashboard") instead of a problem.
- Treating founder intuition as evidence without labeling it as such.
- Scoping the problem so broadly it can never be falsified.
