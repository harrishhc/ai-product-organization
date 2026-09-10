// Waste-observability instrumentation (task guardrails: "make waste
// observable"). One instance per PDM session/run. Cheap, in-memory, no I/O.

export const MAX_DELEGATION_DEPTH = 3;

export function createSession() {
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
    summary() {
      return { ...counters, contextLoads: [...counters.contextLoads] };
    },
  };
}
