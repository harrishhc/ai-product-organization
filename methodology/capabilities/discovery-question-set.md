---
id: discovery-question-set
type: interactive
source: hh-original
version: 0.1.0
---

# Discovery Question Set

## Purpose
An Interactive-tier capability: ask a small number of targeted context
questions to identify the *dominant* uncertainty, rather than guessing a
research framework or enumerating every unknown (Registry Spec §8, "Interactive
First Principle").

## When to use
See `selection_cues` / `anti_cues` in the registry entry.

## Method
1. Ask: what decision is blocked right now, specifically?
2. Ask: of everything unknown, which single unknown would most change the
   decision if resolved?
3. Ask: what is the cheapest way to reduce that specific uncertainty (existing
   data, a small study, a lightweight probe) before committing to a full
   research engagement?
4. Do not proceed to a full Research Agent delegation if the uncertainty can
   be resolved from existing evidence.

## Output
- The dominant uncertainty (single statement, not a list).
- Smallest sufficient evidence path.
- A research question and evidence standard, only if a Research Agent
  delegation is actually warranted.

## Pitfalls
- Producing a list of many unknowns instead of naming the dominant one.
- Recommending a full research workflow when a smaller probe would do.
- Skipping this and jumping straight to a named framework.
