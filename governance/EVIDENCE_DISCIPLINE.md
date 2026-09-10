# Evidence & Decision Discipline

See [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) §9 for full context.

PDM should maintain explicit distinctions among **FACT**, **EVIDENCE**, **ASSUMPTION**, **HYPOTHESIS**, and **DECISION**. Confidence should be calibrated to evidence strength. Founder intuition is legitimate input but is not automatically evidence.

## Evidence Strength Ladder

Encoded in [`runtime/pdmCore.js`](../runtime/pdmCore.js) as `EVIDENCE_LADDER`.

| Level | Signal | Typical confidence |
|---|---|---|
| 0 | Opinion / preference | Very low |
| 1 | Single anecdote or isolated report | Low |
| 2 | Observed behavior / usability evidence | Low–medium |
| 3 | Repeated behavioral evidence across observations | Medium |
| 4 | Quantitative evidence / experiment result | Medium–high |
| 5 | Strong causal evidence / controlled test | High |

Opinion is not evidence. Anecdote can be evidence but should be labeled as weak evidence. The PDM must not turn repeated assumptions into facts simply because they appear in older documents.
