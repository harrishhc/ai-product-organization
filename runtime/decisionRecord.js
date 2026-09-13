// Decision Record: the durable projection of a runtime/decision.js decision.
//
// decision.js deliberately produces disposable in-memory objects and says so
// in its own header ("Wiring an actual durable store for decision records is
// a future, separate persistence decision — not made here"). This module is
// that decision, scoped as narrowly as possible: decision records live in the
// product's OWN Product Context (`context.json`'s `decisions` section), which
// is already the authoritative home for product decisions. No second store.
//
// The reason this exists at all: a decision still awaiting HH (state
// RECOMMENDATION) is a Founder checkpoint. If it is not persisted, an
// autonomous run that stops overnight forgets that a product is waiting —
// and on resume either redoes the work or asks HH the same question twice.
// Persisting only *resolved* decisions is not enough.

import { loadProductContext, writeProductContext, getBoundedContext } from './context.js';

/** A decision in this state is a pending Founder checkpoint (decision.js §STATES). */
export const PENDING_STATE = 'RECOMMENDATION';

/**
 * Projects a decision.js object into the compact record that belongs in
 * Product Context. Deliberately drops `history` and `record` (verbose session
 * trail — Product Context is "the smallest durable set needed for product
 * judgment", not a transcript) while keeping the fields a later evaluation
 * needs: what was recommended, at what confidence, against which
 * alternatives and risks.
 *
 * `classification: 'DECISION'` is asserted ONLY once HH has actually decided.
 * A pending record carries its `state` and makes no classification claim,
 * so nothing downstream can read a proposal as settled product truth.
 */
export function toDecisionRecord(decision, { recordedAt } = {}) {
  if (!decision?.id || !decision?.state) {
    throw new Error('toDecisionRecord requires a decision object with an id and a state (from runtime/decision.js).');
  }
  const now = new Date().toISOString();
  const resolved = decision.founder_decision != null;
  return {
    id: decision.id,
    state: decision.state,
    ...(resolved ? { classification: 'DECISION' } : {}),
    problem: decision.problem ?? null,
    recommendation: decision.recommendation ?? null,
    confidence: decision.confidence ?? null,
    alternatives: decision.alternatives ?? [],
    risks: decision.risks ?? [],
    opportunity_cost: decision.opportunity_cost ?? null,
    assumptions: decision.assumptions ?? [],
    // Kept permanently distinct from `recommendation`, never merged — the
    // same invariant runtime/decision.js enforces in memory.
    founder_decision: decision.founder_decision ?? null,
    recorded_at: recordedAt ?? now,
    updated_at: now,
  };
}

function readDecisionsArray(context, productId) {
  const decisions = context.decisions ?? [];
  if (!Array.isArray(decisions)) {
    throw new Error(`Product "${productId}"'s context.json has a "decisions" field that is not an array; refusing to write.`);
  }
  return decisions;
}

/**
 * Writes a decision record into the product's own Product Context, by id:
 * the same decision persisted twice updates one record rather than appending
 * a duplicate, so a pending checkpoint and its later resolution are one row
 * with a moving `state`, not two competing rows.
 *
 * Local write only. For git_remote products the caller must then publish
 * (bin/pdm-git.mjs publish) — see governance/WORK_STATE_BOUNDARY.md; a local
 * write is not durable on its own.
 */
export function upsertDecisionRecord(productId, decision) {
  const context = loadProductContext(productId);
  const decisions = readDecisionsArray(context, productId);
  const existing = decisions.find((d) => d.id === decision.id);
  const record = toDecisionRecord(decision, { recordedAt: existing?.recorded_at });
  const nextDecisions = existing
    ? decisions.map((d) => (d.id === decision.id ? record : d))
    : [...decisions, record];
  writeProductContext(productId, { ...context, decisions: nextDecisions });
  return { productId, decisionId: record.id, state: record.state, pending: record.state === PENDING_STATE };
}

/**
 * The cheap check the portfolio loop runs per product: bounded read of one
 * section, never the whole context.
 */
export function listPendingCheckpoints(productId) {
  const { decisions } = getBoundedContext(productId, ['decisions']);
  if (!Array.isArray(decisions)) return [];
  return decisions.filter((d) => d.state === PENDING_STATE);
}

/** True when this product is waiting on HH and must be skipped by work selection. */
export function isAwaitingFounder(productId) {
  return listPendingCheckpoints(productId).length > 0;
}
