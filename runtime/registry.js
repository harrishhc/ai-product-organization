// Capability Registry resolver: metadata-first routing over the HH-owned
// methodology baseline. Registry metadata is small and loaded once per
// process; detailed capability instructions (methodology/capabilities/*.md)
// are read from disk lazily, only after a candidate has been selected.
//
// This module never performs network access and never reads from vendor/.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REGISTRY_PATH = path.join(__dirname, '..', 'methodology', 'registry', 'registry.json');
const CAPABILITIES_DIR = path.join(__dirname, '..', 'methodology', 'capabilities');

let cachedRegistry = null;

/**
 * Loads compact registry metadata. Cached for the life of the process so
 * repeated routing within a session does not re-read/re-parse the file
 * (Runtime Architecture §19: "reuse stable session state").
 */
export function loadRegistryMetadata() {
  if (cachedRegistry) return cachedRegistry;
  const raw = readFileSync(REGISTRY_PATH, 'utf8');
  cachedRegistry = JSON.parse(raw);
  return cachedRegistry;
}

/** Test/dev helper to force a fresh read on the next call. */
export function _resetRegistryCache() {
  cachedRegistry = null;
}

/**
 * Filters + qualitatively ranks candidates from metadata only (Registry Spec
 * §7 scoring model). Never opens a capability's detail file.
 *
 * @param {{ intents?: string[], decisionStage?: string }} query
 * @returns {Array<{ id: string, name: string, type: string, fit: 'strong_fit'|'fit'|'weak_fit', matchedIntents: string[] }>}
 */
export function filterCandidates({ intents = [], decisionStage } = {}) {
  const { capabilities } = loadRegistryMetadata();
  const results = [];
  for (const cap of capabilities) {
    const matchedIntents = cap.primary_intents.filter((i) => intents.includes(i));
    const stageMatch = decisionStage ? cap.decision_stage === decisionStage : false;
    if (matchedIntents.length === 0 && !stageMatch) continue;

    let fit = 'weak_fit';
    if (matchedIntents.length > 0 && stageMatch) fit = 'strong_fit';
    else if (matchedIntents.length > 0 || stageMatch) fit = 'fit';

    results.push({ id: cap.id, name: cap.name, type: cap.type, fit, matchedIntents });
  }

  const fitRank = { strong_fit: 0, fit: 1, weak_fit: 2 };
  results.sort((a, b) => fitRank[a.fit] - fitRank[b.fit]);
  return results;
}

/**
 * Smallest-sufficient selection: prefer component < interactive < workflow
 * among equally-fit candidates (Capability Integration Spec §5).
 */
const TIER_RANK = { component: 0, interactive: 1, prompt: 1, workshop: 1, flow: 1, loop: 1, advisor: 1, workflow: 2 };

export function selectSmallestSufficient(candidates) {
  if (candidates.length === 0) return null;
  const best = candidates.filter((c) => c.fit === candidates[0].fit);
  best.sort((a, b) => (TIER_RANK[a.type] ?? 1) - (TIER_RANK[b.type] ?? 1));
  return best[0];
}

/**
 * Lazily loads one capability's full instructions. Only call this after a
 * candidate has been selected — never for every candidate under
 * consideration (Runtime Architecture §7, Registry Spec §15).
 */
export function loadCapabilityDetail(id) {
  const { capabilities } = loadRegistryMetadata();
  const meta = capabilities.find((c) => c.id === id);
  if (!meta) {
    throw new Error(`Unknown capability id: ${id}`);
  }
  const detailPath = path.join(__dirname, '..', meta.source_reference.replace(/\//g, path.sep));
  const detail = readFileSync(detailPath, 'utf8');
  return { meta, detail };
}

export function listCapabilityIds() {
  return loadRegistryMetadata().capabilities.map((c) => c.id);
}

export { CAPABILITIES_DIR };
