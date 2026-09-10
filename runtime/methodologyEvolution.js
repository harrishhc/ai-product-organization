// Methodology Evolution boundary (Upstream Methodology Governance & Sync
// Specification §6, §7A-9). This module is the ONLY place external
// methodology review may ever be initiated, and it must never be reached
// from ordinary PDM orchestration.
//
// Invariant: nothing in this file performs network I/O on its own. A
// deliberate, HH-initiated maintenance script must inject its own
// `fetchUpstream` implementation. `runtime/orchestrator.js` must never
// import this module — see tests/methodology-evolution.test.js.

export const SYNC_WORKFLOW_STAGES = Object.freeze([
  'REQUEST',
  'FETCH_REVIEW',
  'DIFF',
  'CLASSIFY',
  'VALIDATE',
  'IMPACT_REVIEW',
  'HH_APPROVAL',
  'ADAPT_ADOPT',
  'UPDATE_REGISTRY',
  'EVALUATE',
]);

export const CHANGE_CLASSES = Object.freeze({ LOW: 'low', MEDIUM: 'medium', HIGH: 'high' });

/**
 * Entry point for a deliberate methodology-maintenance task. Never called
 * automatically or as a side effect of a product/PDM session.
 *
 * @param {{
 *   initiatedByHH: boolean,
 *   fetchUpstream: () => Promise<unknown>,
 *   session?: { recordNetworkCall: (reason: string) => void }
 * }} params
 */
export async function reviewExternalMethodology({ initiatedByHH, fetchUpstream, session }) {
  if (!initiatedByHH) {
    throw new Error('reviewExternalMethodology may only run for an explicit, deliberate HH-initiated maintenance task.');
  }
  if (typeof fetchUpstream !== 'function') {
    throw new Error(
      'reviewExternalMethodology requires an explicit fetchUpstream function; this module performs no network access on its own.'
    );
  }
  session?.recordNetworkCall?.('methodology_maintenance_review');
  const upstreamSnapshot = await fetchUpstream();
  return {
    stage: 'FETCH_REVIEW',
    upstreamSnapshot,
    note:
      'Snapshot fetched for review only. It has NOT been diffed, classified, validated, or approved, ' +
      'and does not affect the runtime HH methodology baseline until every governance stage completes.',
  };
}

/**
 * Upstream Governance §6.3 classification. Behavioral/routing/governance
 * changes must never be silently adopted.
 */
export function classifyChange({ behavioral = false, altersRouting = false, altersGovernance = false } = {}) {
  if (altersGovernance || altersRouting) return CHANGE_CLASSES.HIGH;
  if (behavioral) return CHANGE_CLASSES.MEDIUM;
  return CHANGE_CLASSES.LOW;
}

/** Stages that require a recorded, explicit HH approval before proceeding. */
export function requiresExplicitApproval(stage) {
  return stage === 'HH_APPROVAL' || stage === 'ADAPT_ADOPT' || stage === 'UPDATE_REGISTRY';
}
