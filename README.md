# AI Product Organization

A reusable, continuously-evolving AI Product Organization: HH acts as Founder / CEO, PDM acts as Senior Product Director, and Research / Design / QA / Engineering are reusable functional agents across products. Products iterate continuously; agent capabilities improve through an independent evolution system.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full architecture record (v0.3).

## Core Principle

Capabilities are reusable. Context is product-specific. Products continuously evolve. Agents continuously improve. Governance prevents cross-contamination.

## Layout

```
agents/          reusable functional capabilities (cross-product)
  pdm/           Senior Product Director role
  research/      Research agent
  design/        Design agent
  qa/            QA agent
  engineering/   Engineering / Coding agent
  evolution/     PDM Evolution Agent (independent evolution plane)
products/        product-specific context (one folder per product)
governance/      role boundaries, decision model, delegation logic, governance principles
methodology/     vendored/pinned upstream methodology, versioned separately from PDM Core
docs/            architecture records
```

## Status

v0.3 architectural record. This repo currently holds the skeleton only — detailed skill implementations, subordinate-agent prompts, evaluation cases, and product-specific strategy are designed after the PDM Constitution is finalized.
