// PDM Orchestrator: mechanism, not judgment. It enforces the architectural
// bounds (stage selection, metadata-first capability routing, bounded
// context retrieval, bounded specialist delegation, instrumentation) that
// the PDM (the reasoning agent using this runtime) operates within. Which
// stages/capabilities/delegations are actually necessary for a given
// interaction is a PDM judgment call supplied as input, not decided here.
//
// This module must never import runtime/methodologyEvolution.js — ordinary
// orchestration must have zero path to external methodology review.

import { filterCandidates, selectSmallestSufficient, loadCapabilityDetail, resolveComposition } from './registry.js';
import { getBoundedContext } from './context.js';
import { selectDelegate } from './pdmCore.js';
import { MAX_DELEGATION_DEPTH } from './instrumentation.js';

// Specification §5 — the full reasoning loop. A given interaction should use
// only the necessary subset, chosen by PDM judgment, not all twelve stages.
export const REASONING_STAGES = Object.freeze([
  'LISTEN',
  'FRAME',
  'IDENTIFY_UNKNOWNS',
  'ANALYZE',
  'CHALLENGE',
  'EXPLORE_OPTIONS',
  'PRIORITIZE',
  'VALIDATE',
  'DECIDE',
  'DOCUMENT',
  'DELEGATE',
  'REVIEW',
]);

export function runStage(stageName, session) {
  if (!REASONING_STAGES.includes(stageName)) {
    throw new Error(`Unknown reasoning stage: ${stageName}. Must be one of ${REASONING_STAGES.join(', ')}.`);
  }
  session?.recordToolCall?.(`stage:${stageName}`);
  return { stage: stageName, at: new Date().toISOString() };
}

/**
 * Metadata-first capability selection. Requires an explicit statement of the
 * dominant uncertainty being resolved (Capability Integration Spec §5,
 * Registry Spec §2/§5) — selection must be anchored to "what decision
 * bottleneck are we reducing", not to intents/decisionStage alone or a raw
 * keyword/name match. `intents`/`decisionStage` are how that already-
 * identified uncertainty gets operationalized into a registry query; they do
 * not replace stating it. Never loads capability detail files; that only
 * happens in loadSelectedCapability(), after a candidate is chosen.
 */
export function selectCapability({ dominantUncertainty, intents, decisionStage, spansMultipleStages = false }, session) {
  if (!dominantUncertainty) {
    throw new Error(
      'selectCapability requires an explicit dominantUncertainty (the decision bottleneck this selection is meant to reduce) — routing must not be intent/stage matching alone.'
    );
  }
  const candidates = filterCandidates({ intents, decisionStage, dominantUncertainty });
  session?.recordCapabilitySelection?.(candidates.map((c) => c.id));
  const selected = selectSmallestSufficient(candidates, { spansMultipleStages });
  return { selected, candidates, dominantUncertainty };
}

export function loadSelectedCapability(selected, session) {
  if (!selected) {
    throw new Error('loadSelectedCapability requires a selected candidate (from selectCapability).');
  }
  const { meta, detail } = loadCapabilityDetail(selected.id);
  session?.recordCapabilityDetailLoad?.(selected.id, detail);
  return { meta, detail };
}

/**
 * Resolves the selected entrypoint's declared composition before any detail is
 * loaded. Selecting an entrypoint is not the whole routing step: a workflow
 * entrypoint declares the methodology it is built from, and without resolving
 * that, PDM would enter a composed workflow and re-invent its sequence.
 *
 * This is mechanism, not judgment — it reports what the methodology declares.
 * Which members the current work unit actually needs stays a PDM decision, and
 * each one is loaded individually via loadSelectedCapability().
 */
export function resolveSelectedComposition(selected, session) {
  if (!selected) {
    throw new Error('resolveSelectedComposition requires a selected candidate (from selectCapability).');
  }
  const resolved = resolveComposition(selected.id);
  session?.recordToolCall?.(`composition:${selected.id}`);
  return resolved;
}

/** Bounded Product Context retrieval — never the full product object. */
export function retrieveContext(productId, sections, session) {
  const bounded = getBoundedContext(productId, sections);
  session?.recordContextLoad?.(productId, sections);
  return bounded;
}

/**
 * Opens a bounded specialist delegation. Throws if it would exceed
 * MAX_DELEGATION_DEPTH (instrumentation.js) — this is the enforced stop
 * condition against unbounded/recursive delegation.
 */
export function delegateToSpecialist({ dominantUncertaintyType, question, expectedOutput, decisionInformed }, session) {
  const agent = selectDelegate(dominantUncertaintyType);
  if (!agent) {
    throw new Error(
      `No specialist delegate is mapped for uncertainty type "${dominantUncertaintyType}". PDM should resolve this without delegation.`
    );
  }
  if (!question || !expectedOutput || !decisionInformed) {
    throw new Error('Delegation requires an explicit question, expectedOutput, and decisionInformed (Runtime Architecture §10 invocation contract).');
  }
  const depth = session.enterDelegation(agent);
  return { agent, question, expectedOutput, decisionInformed, depth };
}

/** Caller must invoke this once the specialist's result has been returned to PDM. */
export function completeDelegation(session) {
  session.exitDelegation();
}

export function delegationBudgetRemaining(session) {
  return MAX_DELEGATION_DEPTH - session.summary().delegationDepth;
}
