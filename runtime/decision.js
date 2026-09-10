// Decision / recommendation state model (Specification §6, Runtime
// Architecture §15). PDM recommendation and HH's founder_decision are kept
// as permanently distinct fields — recording a Founder decision never
// overwrites or erases the PDM's recommendation, even under override.

export const STATES = Object.freeze([
  'IDEA',
  'FRAMING',
  'LEARNING',
  'RECOMMENDATION',
  'FOUNDER_DECISION',
  'EXECUTION',
  'REVIEW',
  'HALTED',
]);

export const ALLOWED_TRANSITIONS = Object.freeze({
  IDEA: ['FRAMING'],
  FRAMING: ['LEARNING', 'RECOMMENDATION'],
  LEARNING: ['RECOMMENDATION', 'FRAMING'],
  RECOMMENDATION: ['FOUNDER_DECISION'],
  FOUNDER_DECISION: ['EXECUTION', 'LEARNING', 'HALTED'],
  EXECUTION: ['REVIEW'],
  REVIEW: ['LEARNING'],
  HALTED: ['LEARNING', 'IDEA'],
});

function assertTransition(from, to) {
  const allowed = ALLOWED_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    throw new Error(`Illegal decision-state transition: ${from} -> ${to}`);
  }
}

export function createDecision({ context, problem }) {
  if (!context || !problem) {
    throw new Error('createDecision requires both context and problem.');
  }
  const now = new Date().toISOString();
  return {
    id: `dec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    state: 'IDEA',
    context,
    problem,
    evidence: [],
    unknowns: [],
    assumptions: [],
    alternatives: [],
    risks: [],
    opportunity_cost: null,
    recommendation: null,
    confidence: null,
    founder_decision: null,
    record: [],
    history: [{ state: 'IDEA', at: now }],
  };
}

export function transition(decision, nextState, note) {
  assertTransition(decision.state, nextState);
  return {
    ...decision,
    state: nextState,
    history: [...decision.history, { state: nextState, at: new Date().toISOString(), note }],
  };
}

/**
 * Records the PDM's recommendation and the decision-protocol fields it rests
 * on (Specification §6). Requires both `recommendation` and `confidence`.
 */
export function setRecommendation(
  decision,
  { recommendation, confidence, evidence, unknowns, assumptions, alternatives, risks, opportunityCost }
) {
  if (recommendation === undefined || confidence === undefined) {
    throw new Error('setRecommendation requires both recommendation and confidence.');
  }
  const updated = {
    ...decision,
    evidence: evidence ?? decision.evidence,
    unknowns: unknowns ?? decision.unknowns,
    assumptions: assumptions ?? decision.assumptions,
    alternatives: alternatives ?? decision.alternatives,
    risks: risks ?? decision.risks,
    opportunity_cost: opportunityCost ?? decision.opportunity_cost,
    recommendation,
    confidence,
  };
  return transition(updated, 'RECOMMENDATION', 'PDM recommendation recorded');
}

/**
 * Records HH's decision. `hhDecision` is a free-form label the caller
 * chooses (e.g. an approved alternative, 'dont_build_yet', or
 * 'need_more_evidence'); it is ALWAYS stored separately from
 * `decision.recommendation`, never merged into it — even when HH agrees.
 */
export function recordFounderDecision(decision, { hhDecision, isOverride = false }) {
  if (decision.state !== 'RECOMMENDATION') {
    throw new Error(`Cannot record a Founder decision before a recommendation exists (current state: ${decision.state}).`);
  }
  if (hhDecision === undefined) {
    throw new Error('recordFounderDecision requires hhDecision.');
  }
  const overridden = isOverride && hhDecision !== decision.recommendation;
  const withDecision = transition(
    {
      ...decision,
      founder_decision: { hhDecision, overridden, decidedAt: new Date().toISOString() },
    },
    'FOUNDER_DECISION',
    'Founder decision recorded'
  );
  const nextState = hhDecision === 'dont_build_yet' ? 'HALTED' : hhDecision === 'need_more_evidence' ? 'LEARNING' : 'EXECUTION';
  return transition(withDecision, nextState, `Routed to ${nextState}`);
}

/** Appends to the durable "what must be remembered for later evaluation" record. */
export function appendRecord(decision, note) {
  return { ...decision, record: [...decision.record, { note, at: new Date().toISOString() }] };
}
