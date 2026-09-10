// Metadata-first methodology resolver over the HH-owned baseline.
// Detailed methodology assets are loaded only after selection.
// This module never performs network access and never reads vendor/.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const METHODOLOGY_ROOT = path.join(__dirname, '..', 'methodology');
const REGISTRY_PATH = path.join(METHODOLOGY_ROOT, 'registry', 'ecosystem.json');
const LEGACY_REGISTRY_PATH = path.join(METHODOLOGY_ROOT, 'registry', 'registry.json');
const CAPABILITIES_DIR = path.join(METHODOLOGY_ROOT, 'capabilities');

let cachedRegistry = null;

export function loadRegistryMetadata() {
  if (cachedRegistry) return cachedRegistry;
  try {
    cachedRegistry = JSON.parse(readFileSync(REGISTRY_PATH, 'utf8'));
  } catch (error) {
    // Backward-compatible bootstrap path for repositories before ecosystem registry migration.
    cachedRegistry = JSON.parse(readFileSync(LEGACY_REGISTRY_PATH, 'utf8'));
    cachedRegistry._legacy = true;
  }
  return cachedRegistry;
}

export function _resetRegistryCache() { cachedRegistry = null; }

/**
 * Filters candidates using only compact metadata. dominantUncertainty is a
 * required decision input at the orchestrator boundary; if a capability
 * declares explicit uncertainty_types, they are enforced here. Unknown
 * uncertainty metadata remains neutral rather than being guessed.
 */
export function filterCandidates({ intents = [], decisionStage, dominantUncertainty } = {}) {
  if (dominantUncertainty === undefined || dominantUncertainty === null || dominantUncertainty === '') {
    throw new Error('dominantUncertainty is required for capability selection');
  }
  const { capabilities = [] } = loadRegistryMetadata();
  const results = [];

  for (const cap of capabilities) {
    const matchedIntents = (cap.primary_intents ?? []).filter((i) => intents.includes(i));
    const stageMatch = decisionStage ? cap.decision_stage === decisionStage : false;
    const uncertaintyTypes = cap.uncertainty_types ?? null;
    const uncertaintyMatch = uncertaintyTypes
      ? (uncertaintyTypes.includes(dominantUncertainty) ? 'matched' : 'mismatch')
      : 'unknown';

    if (uncertaintyMatch === 'mismatch') continue;
    if (matchedIntents.length === 0 && !stageMatch) continue;

    let fit = 'weak_fit';
    if (matchedIntents.length > 0 && stageMatch) fit = 'strong_fit';
    else if (matchedIntents.length > 0 || stageMatch) fit = 'fit';
    if (uncertaintyMatch === 'matched' && fit === 'fit') fit = 'strong_fit';

    results.push({
      id: cap.id,
      name: cap.name,
      type: cap.type,
      fit,
      matchedIntents,
      uncertaintyMatch,
    });
  }

  const fitRank = { strong_fit: 0, fit: 1, weak_fit: 2 };
  const uncertaintyRank = { matched: 0, unknown: 1, mismatch: 2 };
  results.sort((a, b) =>
    (fitRank[a.fit] - fitRank[b.fit]) ||
    (uncertaintyRank[a.uncertaintyMatch] - uncertaintyRank[b.uncertaintyMatch]) ||
    a.id.localeCompare(b.id),
  );
  return results;
}

const TIER_RANK = {
  component: 0, interactive: 1, prompt: 1, workshop: 1, flow: 1, loop: 1,
  advisor: 1, pattern: 1, skeleton: 1, generator: 1, 'market-intelligence': 1,
  workflow: 2,
};

export function selectSmallestSufficient(candidates) {
  if (candidates.length === 0) return null;
  const bestFit = candidates[0].fit;
  const best = candidates.filter((c) => c.fit === bestFit);
  best.sort((a, b) => (TIER_RANK[a.type] ?? 1) - (TIER_RANK[b.type] ?? 1) || a.id.localeCompare(b.id));
  return best[0];
}

function resolveMethodologyPath(sourceReference) {
  if (typeof sourceReference !== 'string' || !sourceReference.startsWith('methodology/')) {
    throw new Error(`Invalid methodology source reference: ${sourceReference}`);
  }
  const target = path.resolve(__dirname, '..', sourceReference);
  const relative = path.relative(METHODOLOGY_ROOT, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Methodology path escapes root: ${sourceReference}`);
  }
  return target;
}

/** Load one selected asset; no candidate fan-out or eager dependency loading. */
export function loadAsset(id) {
  const { assets = [] } = loadRegistryMetadata();
  const meta = assets.find((a) => a.id === id);
  if (!meta) throw new Error(`Unknown methodology asset id: ${id}`);
  const detail = readFileSync(resolveMethodologyPath(meta.source_reference), 'utf8');
  return { meta, detail };
}

/** Backward-compatible name for callers that still think in capabilities. */
export function loadCapabilityDetail(id) {
  const { capabilities = [] } = loadRegistryMetadata();
  const meta = capabilities.find((c) => c.id === id);
  if (!meta) throw new Error(`Unknown capability id: ${id}`);
  return loadAsset(id);
}

export function listCapabilityIds() {
  return (loadRegistryMetadata().capabilities ?? []).map((c) => c.id);
}

export function listAssets({ type } = {}) {
  const assets = loadRegistryMetadata().assets ?? [];
  return type ? assets.filter((a) => a.type === type) : assets;
}

export { CAPABILITIES_DIR };
