// Waste-observability instrumentation (task guardrails: "make waste
// observable"). One instance per PDM session/run. Cheap, in-memory, no I/O.
//
// Also the Runtime Governor: this module answers "may the loop keep going?"
// (shouldContinue), while PDM decides "what to work on next". It never
// performs I/O to find out — the authoritative usage signal, which only the
// host harness can know, is injected as `budget.isExhausted`, the same
// pattern productSync.js uses for git.

export const MAX_DELEGATION_DEPTH = 3;

export const STOP_REASONS = Object.freeze({
  EXTERNAL_USAGE_EXHAUSTED: 'external_usage_exhausted',
  ESTIMATED_TOKENS_EXHAUSTED: 'estimated_tokens_exhausted',
  TOOL_CALLS_EXHAUSTED: 'tool_calls_exhausted',
  WORK_ITEMS_EXHAUSTED: 'work_items_exhausted',
});

/**
 * @param {{ budget?: {
 *   maxEstimatedTokens?: number,
 *   maxToolCalls?: number,
 *   maxWorkItems?: number,
 *   isExhausted?: () => boolean
 * } }} [options] - omit entirely for an unbudgeted session (shouldContinue()
 *   then always allows continuing, which is the pre-existing behaviour).
 */
export function createSession({ budget } = {}) {
  const counters = {
    contextSectionsLoaded: 0,
    contextLoads: [],
    capabilitySelectionCount: 0,
    capabilityDetailLoads: 0,
    specialistDelegationCount: 0,
    toolCalls: 0,
    networkCalls: 0,
    delegationDepth: 0,
    maxDelegationDepth: 0,
    estimatedTokens: 0,
    workItems: 0,
  };

  function estimateTokens(text) {
    // Rough, deterministic heuristic (chars/4); good enough to make relative
    // waste visible without depending on a tokenizer dependency.
    return Math.ceil(String(text ?? '').length / 4);
  }

  return {
    recordContextLoad(productId, sections) {
      counters.contextSectionsLoaded += sections.length;
      counters.contextLoads.push({ productId, sections, at: new Date().toISOString() });
    },
    recordCapabilitySelection(id) {
      counters.capabilitySelectionCount += 1;
    },
    recordCapabilityDetailLoad(id, detailText) {
      counters.capabilityDetailLoads += 1;
      counters.estimatedTokens += estimateTokens(detailText);
    },
    recordToolCall(name) {
      counters.toolCalls += 1;
    },
    recordNetworkCall(reason) {
      counters.networkCalls += 1;
    },
    enterDelegation(agentType) {
      counters.delegationDepth += 1;
      counters.maxDelegationDepth = Math.max(counters.maxDelegationDepth, counters.delegationDepth);
      counters.specialistDelegationCount += 1;
      if (counters.delegationDepth > MAX_DELEGATION_DEPTH) {
        throw new Error(
          `Delegation depth ${counters.delegationDepth} exceeds MAX_DELEGATION_DEPTH (${MAX_DELEGATION_DEPTH}) while delegating to ${agentType}.`
        );
      }
      return counters.delegationDepth;
    },
    exitDelegation() {
      counters.delegationDepth = Math.max(0, counters.delegationDepth - 1);
    },
    addEstimatedTokens(text) {
      counters.estimatedTokens += estimateTokens(text);
    },
    /** One completed unit of portfolio work (Dean's /batch item cap applied to products). */
    recordWorkItem(label) {
      counters.workItems += 1;
      return counters.workItems;
    },
    /**
     * The Runtime Governor's only question. Checked between work items, never
     * mid-item — a loop that stops halfway through a work item leaves state
     * the next run has to reason about.
     *
     * `budget.isExhausted` is checked first and deliberately: it is the only
     * authoritative signal (the host harness knows the real quota).
     * `estimatedTokens` is a chars/4 heuristic, useful as a self-imposed
     * ceiling, never as billing truth.
     *
     * @returns {{ canContinue: boolean, reason: string|null }}
     */
    shouldContinue() {
      if (!budget) return { canContinue: true, reason: null };
      if (typeof budget.isExhausted === 'function' && budget.isExhausted()) {
        return { canContinue: false, reason: STOP_REASONS.EXTERNAL_USAGE_EXHAUSTED };
      }
      if (budget.maxEstimatedTokens != null && counters.estimatedTokens >= budget.maxEstimatedTokens) {
        return { canContinue: false, reason: STOP_REASONS.ESTIMATED_TOKENS_EXHAUSTED };
      }
      if (budget.maxToolCalls != null && counters.toolCalls >= budget.maxToolCalls) {
        return { canContinue: false, reason: STOP_REASONS.TOOL_CALLS_EXHAUSTED };
      }
      if (budget.maxWorkItems != null && counters.workItems >= budget.maxWorkItems) {
        return { canContinue: false, reason: STOP_REASONS.WORK_ITEMS_EXHAUSTED };
      }
      return { canContinue: true, reason: null };
    },
    summary() {
      return { ...counters, contextLoads: [...counters.contextLoads] };
    },
  };
}
