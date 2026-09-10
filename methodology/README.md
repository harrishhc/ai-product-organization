# HH-Owned Methodology

This directory is the **canonical methodology source of truth for PDM**.

## Genesis

The initial baseline was imported from two external ecosystems:

- Dean Peters — Product Manager Skills, pinned to `1b5a524ebb95e9497fa3f25002d8b8ec528d4444`
- Dean Peters — Product Manager Prompts, pinned to `c3b91dba8f7782fac72c7aa340b98d6554b1f3ec`

The import is a **genesis seed, not a permanent upstream dependency**. After genesis, HH owns this repository's methodology. HH may modify, merge, split, rename, delete, or create methodology assets without preserving upstream compatibility.

See `provenance/GENESIS.md` for the genesis boundary and source commits.

## Structure

```text
methodology/
  skills/                 # imported PM skills; HH-owned after genesis
  commands/               # imported command workflows
  catalog/                # source catalog/index material
  prompts/                # imported prompt ecosystem, namespaced to avoid collisions
  capabilities/           # HH-authored local capabilities
  registry/               # compact metadata used for runtime routing
  provenance/             # genesis/source provenance; not runtime instructions
```

The repository may contain a large methodology library, but **the runtime must not load the whole library into active context**. Registry metadata is used first; detailed instructions are loaded only after the PDM narrows the candidate set.

## Runtime boundary

- PDM reads the local approved methodology baseline.
- Ordinary product work makes no network request to upstream methodology repositories.
- Product Context remains product-specific and is never embedded into methodology assets automatically.
- Methodology changes are deliberate HH-owned evolution work.
- The registry is derived metadata, not a second source of truth.

## Capability authority

Methodology assets provide methods, frameworks, prompts, facilitation, and structured analysis. They **do not own product decisions**. The authority chain remains:

`methodology → analysis/method → PDM synthesis/recommendation → HH decision where Founder authority applies`

## Evolution principle

The intended long-term model is:

> Take the upstream ecosystem as the first-generation genetic base; evolve it into the methodology HH actually wants.

The goal is not to remain compatible with the upstream repository forever. The goal is to build a better, internally coherent methodology through evidence, evaluation, and governed iteration.
