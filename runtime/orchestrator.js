// Mechanism only: the orchestrator does not invent product judgment.
// It sequences stages, routes an already-identified uncertainty, loads one
// selected methodology asset, retrieves bounded product context, and delegates
// bounded questions to specialists.

import {
  filterCandidates,
  selectSmallestSufficient,
  loadCapabilityDetail,
} from './registry.js';
import { getBoundedContext } from './context.js';

export const REASONING_STAGES = Object.freeze([
  'LISTEN', 'FRAME', 'IDENTIFY_UNKNOWNS', 'ANALYZE', 'CHALLENGE', 'EXPLORE_OPTIONS',
  'PRIORITIZE', 'VALIDATE', 'DECIDE', 'DOCUMENT', 'DELEGATE', 'REVIEW',
]);

export function runStage(stage, session) {
  if (!REASONING_STAGES.includes(stage)) throw new Error(`Unknown reasoning stage: ${stage}`);
  session?.recordToolCall?.(`stage:${stage}`);
  return { stage };
}

/**
 * Selects methodology using the PDM's already-identified dominant uncertainty.
 * `intents` and `decisionStage` operationalize that uncertainty in compact
 * registry metadata; they never substitute for the uncertainty statement.
 */
export function selectCapability({ dominantUncertainty, intents, decisionStage }, session) {
  if (!dominantUncertainty) {
    throw new Error(
      'selectCapability requires an explicit dominantUncertainty (the decision bottleneck this selection is meant to reduce) — routing must not be intent/stage matching alone.'
    );
  }
  const candidates = filterCandidates({ intents, decisionStage, dominantUncertainty });
  session?.recordCapabilitySelection?.(candidates.map((c) => c.id));
  const selected = selectSmallestSufficient(candidates);
  return { selected, candidates, dominantUncertainty };
}

export function loadSelectedCapability(selected, session) {
  if (!selected) throw new Error('loadSelectedCapability requires a selected candidate (from selectCapability).');
  const { meta, detail } = loadCapabilityDetail(selected.id);
  session?.recordCapabilityDetailLoad?.(selected.id, detail);
  return { meta, detail };
}

/** Bounded Product Context retrieval — never the full product object. */
export function retrieveContext(productId, sections, session) {
  const bounded = getBoundedContext(productId, sections);
  session?.recordContextLoad?.(productId, sections);
  return bounded;
}

/** Opens a bounded specialist delegation. Throws if it would exceed the depth budget. */
export function delegateToSpecialist(request, session) {
  if (!request?.dominantUncertaintyType || !request?.question || !request?.expectedOutput || !request?.decisionInformed) {
    throw new Error('delegation requires dominantUncertaintyType, question, expectedOutput, and decisionInformed');
  }
  const allowed = ['user_need', 'experience', 'technical_feasibility', 'quality'];
  if (!allowed.includes(request.dominantUncertaintyType)) throw new Error(`unmapped uncertainty type: ${request.dominantUncertaintyType}`);
  const maxDepth = session?.maxDelegationDepth ?? 2;
  const current = session?.summary?.().delegationDepth ?? 0;
  if (current >= maxDepth) throw new Error(`delegation depth exceeded: max ${maxDepth}`);
  session?.recordDelegationStart?.(request);
  return request;
}

export function completeDelegation(session) {
  session?.recordDelegationComplete?.();
}

export function delegationBudgetRemaining(session) {
  const maxDepth = session?.maxDelegationDepth ?? 2;
  return Math.max(0, maxDepth - (session?.summary?.().delegationDepth ?? 0));
}
