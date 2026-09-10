// Evaluation & Evolution Interface (Runtime Architecture §16-17, Registry
// Spec §17-18). Records evaluable behavior signals; never mutates PDM
// behavior itself — that requires a governed PDM Evolution change (see
// runtime/methodologyEvolution.js for the analogous methodology-side gate).

// Specification §18 — behaviors PDM should expose as evaluable, not just as
// subjective "quality."
export const EVALUATION_TESTS = Object.freeze([
  'challenge_test',
  'evidence_test',
  'delegation_test',
  'anti_solutioning_test',
  'founder_override_test',
  'context_isolation_test',
  'learning_test',
]);

// Specification §20 anti-patterns, kept here (not in pdmCore.js) because they
// are evaluation targets, not identity/authority rules.
export const ANTI_PATTERNS = Object.freeze([
  'yes_man_pdm',
  'framework_dumping',
  'prd_first_behavior',
  'context_stuffing',
  'false_certainty',
  'orchestration_theater',
  'scope_drift',
  'memory_leakage',
  'self_authorized_evolution',
]);

// Registry Spec §18 — a routing failure must be classified into exactly one
// of these before it can become a PDM/capability change candidate. Product
// failures must NOT automatically trigger PDM or capability evolution.
export const FAILURE_CLASSES = Object.freeze(['product_failure', 'orchestration_failure', 'capability_failure']);

/**
 * Builds one audit record per Registry Spec §17. Callers should avoid
 * logging raw secrets or full transcripts — this is a compact record, not a
 * second transcript store.
 */
export function buildAuditRecord({
  decisionId,
  selectedIntent,
  dominantUncertainty,
  candidateCapabilities = [],
  selectedCapability,
  selectionRationale,
  contextScope = [],
  resultSummary,
  confidenceBefore,
  confidenceAfter,
  founderOverride = null,
}) {
  return {
    decisionId,
    selectedIntent,
    dominantUncertainty,
    candidateCapabilities,
    selectedCapability,
    selectionRationale,
    contextScope,
    resultSummary,
    confidenceBefore: confidenceBefore ?? null,
    confidenceAfter: confidenceAfter ?? null,
    founderOverride,
    evaluationOutcome: null, // filled in later, once available
    recordedAt: new Date().toISOString(),
  };
}

export function classifyFailure(failureClass) {
  if (!FAILURE_CLASSES.includes(failureClass)) {
    throw new Error(`Unknown failure class: ${failureClass}. Must be one of ${FAILURE_CLASSES.join(', ')}.`);
  }
  // Only orchestration/capability failures are automatic PDM-evolution
  // candidates (Registry Spec §18); product failures require separate
  // product-side analysis and are explicitly excluded here.
  return {
    failureClass,
    isEvolutionCandidate: failureClass !== 'product_failure',
  };
}
