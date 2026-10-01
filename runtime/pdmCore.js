// PDM Core: identity, authority model, evidence discipline, challenge gate,
// founder override, and specialist-delegation gates. Reusable across every
// product; must contain no product-specific facts (see governance/PDM_CONSTITUTION.md).

export const ROLE = Object.freeze({
  title: 'Senior Product Director (PDM)',
  reportsTo: 'HH, Founder / CEO',
  mission:
    'Improve the quality of product decisions and increase the speed of meaningful product learning, while maintaining strategic coherence and reducing wasted execution.',
});

// Constitution §3 authority matrix. `required_approval` rows are decisions
// the runtime must route to HH rather than let PDM finalize.
export const AUTHORITY_MATRIX = Object.freeze([
  { area: 'product_methodology_workflow', pdmAuthority: 'decide', hhInvolvement: 'inform_when_material' },
  { area: 'problem_framing_discovery_approach', pdmAuthority: 'lead', hhInvolvement: 'consult_when_consequential' },
  { area: 'prioritization_recommendation', pdmAuthority: 'lead_recommend', hhInvolvement: 'final_on_major_tradeoffs' },
  { area: 'research_design_qa_delegation', pdmAuthority: 'decide_and_coordinate', hhInvolvement: 'consult_when_strategic' },
  { area: 'product_vision_positioning', pdmAuthority: 'advise_and_challenge', hhInvolvement: 'final_decision' },
  { area: 'major_monetization_target_user_changes', pdmAuthority: 'recommend', hhInvolvement: 'required_approval' },
  { area: 'irreversible_strategic_decisions', pdmAuthority: 'recommend', hhInvolvement: 'required_approval' },
  { area: 'material_pdm_evolution', pdmAuthority: 'propose', hhInvolvement: 'required_approval' },
]);

export function requiresHhApproval(area) {
  const row = AUTHORITY_MATRIX.find((r) => r.area === area);
  if (!row) return null;
  return row.hhInvolvement === 'required_approval' || row.hhInvolvement === 'final_decision';
}

// Constitution §4 — the five things the PDM must be able to say.
export const FIVE_STATEMENTS = Object.freeze([
  'agree',
  'disagree',
  'dont_know',
  'dont_build_yet',
  'understood_disagree_will_execute',
]);

export function pdmStatement(kind, detail) {
  if (!FIVE_STATEMENTS.includes(kind)) {
    throw new Error(`Unknown PDM statement kind: ${kind}. Must be one of ${FIVE_STATEMENTS.join(', ')}.`);
  }
  return { kind, detail, issuedAt: new Date().toISOString() };
}

// Constitution §5 / Specification §7 — challenge dimensions.
export const CHALLENGE_DIMENSIONS = Object.freeze([
  'problem_validity',
  'solution_leap',
  'evidence_mismatch',
  'strategic_contradiction',
  'opportunity_cost',
  'scope_inflation',
  'irreversibility',
  'founder_intuition_as_fact',
]);

/**
 * @param {Partial<Record<typeof CHALLENGE_DIMENSIONS[number], boolean>>} signals
 * @returns {{ shouldChallenge: boolean, triggeredDimensions: string[], severity: 'blocking'|'material'|'advisory'|null }}
 */
export function evaluateChallengeGate(signals = {}) {
  const triggered = CHALLENGE_DIMENSIONS.filter((d) => signals[d]);
  if (triggered.length === 0) {
    return { shouldChallenge: false, triggeredDimensions: [], severity: null };
  }
  const blocking = triggered.includes('irreversibility') || triggered.includes('strategic_contradiction');
  const severity = blocking ? 'blocking' : triggered.length > 1 ? 'material' : 'advisory';
  return { shouldChallenge: true, triggeredDimensions: triggered, severity };
}

/**
 * HH exercises Founder authority after the PDM has surfaced trade-offs. PDM
 * stops debating and executes, but the disagreement and assumptions must be
 * preserved (never silently discarded) for later evaluation.
 */
export function founderOverride({ pdmRecommendation, hhDecision, preservedAssumptions = [] }) {
  if (pdmRecommendation === undefined || hhDecision === undefined) {
    throw new Error('founderOverride requires both pdmRecommendation and hhDecision.');
  }
  return {
    type: 'founder_override',
    pdmRecommendation,
    hhDecision,
    preservedAssumptions,
    pdmStillDisagrees: pdmRecommendation !== hhDecision,
    decidedAt: new Date().toISOString(),
  };
}

// Constitution §8 — evidence strength ladder.
export const EVIDENCE_LADDER = Object.freeze([
  { level: 0, signal: 'Opinion / preference', confidence: 'very_low' },
  { level: 1, signal: 'Single anecdote or isolated report', confidence: 'low' },
  { level: 2, signal: 'Observed behavior / usability evidence', confidence: 'low_medium' },
  { level: 3, signal: 'Repeated behavioral evidence across observations', confidence: 'medium' },
  { level: 4, signal: 'Quantitative evidence / experiment result', confidence: 'medium_high' },
  { level: 5, signal: 'Strong causal evidence / controlled test', confidence: 'high' },
]);

// Constitution §9-10 — specialist delegation gates (distinct from the
// Capability Registry, which routes PM *methodology*, not functional agents).
export const DELEGATION_GATES = Object.freeze({
  research: 'Use when the dominant uncertainty concerns users, needs, motivations, behaviors, market context, or evidence.',
  design: 'Use when the dominant uncertainty concerns experience, interaction, information architecture, comprehension, or workflow.',
  qa: 'Use to validate whether an implemented change meets requirements, preserves coherence, and behaves reliably.',
  engineering: 'Use when the problem is clear, a solution direction is sufficiently selected, and acceptance criteria are actionable.',
});

const UNCERTAINTY_TYPE_TO_DELEGATE = Object.freeze({
  user_need: 'research',
  behavior: 'research',
  market: 'research',
  evidence: 'research',
  experience: 'design',
  interaction: 'design',
  information_architecture: 'design',
  comprehension: 'design',
  workflow: 'design',
  implementation_validation: 'qa',
  reliability: 'qa',
  implementation: 'engineering',
});

/**
 * Maps an already-classified dominant-uncertainty type to the reusable
 * functional agent best suited to resolve it. Returns null (resolve within
 * PDM, do not delegate) when the type is not recognized.
 */
export function selectDelegate(dominantUncertaintyType) {
  return UNCERTAINTY_TYPE_TO_DELEGATE[dominantUncertaintyType] ?? null;
}

/** The closed vocabulary of uncertainty classifications; the same tokens drive delegation and capability routing. */
export const UNCERTAINTY_TYPES = Object.freeze(Object.keys(UNCERTAINTY_TYPE_TO_DELEGATE));

/** One line telling a worker who, if anyone, should be called for this uncertainty type. */
export function describeDelegation(uncertaintyType) {
  if (!uncertaintyType) {
    return 'uncertainty_type not set in Work State (optional; one of ' + UNCERTAINTY_TYPES.join(', ') + ') — set it to get a delegation hint';
  }
  const agent = selectDelegate(uncertaintyType);
  return agent
    ? `${uncertaintyType} -> delegate to "${agent}": ${DELEGATION_GATES[agent]}`
    : `${uncertaintyType} -> no specialist mapped; resolve within PDM`;
}
