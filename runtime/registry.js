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
  } catch {
    cachedRegistry = JSON.parse(readFileSync(LEGACY_REGISTRY_PATH, 'utf8'));
    cachedRegistry._legacy = true;
  }
  return cachedRegistry;
}

export function _resetRegistryCache() { cachedRegistry = null; }

// Function words and generic framing verbs only. A dominant uncertainty is
// written as prose, so these appear in almost every query and in almost every
// asset description; keeping them scoreable makes two unrelated entrypoints tie
// on nothing but English grammar.
const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'what', 'which', 'this', 'that', 'from', 'into', 'about',
  'should', 'would', 'could', 'have', 'has', 'are', 'was', 'were', 'our', 'their', 'not',
  'unclear', 'unknown', 'whether', 'how', 'why', 'who', 'when', 'need', 'needs', 'want',
  'just', 'know', 'like', 'make', 'take', 'able', 'will', 'does', 'done', 'been',
  'them', 'they', 'then', 'than', 'more', 'most', 'some', 'very', 'also', 'only',
  'such', 'same', 'each', 'both', 'much', 'many', 'over', 'here', 'there',
]);

function normalizeText(value) {
  return String(value ?? '').toLowerCase().replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * The free-text self-description a methodology asset already carries in its own
 * frontmatter. Hand-authored routing metadata (primary_intents/decision_stage)
 * exists for only a handful of entrypoints, so without this the rest of the
 * ecosystem is present in the registry but invisible to routing. Cue matches
 * are always ranked below declared metadata — see fit assignment below.
 */
function cueCorpus(cap) {
  return normalizeText([
    cap.name, cap.theme, cap.intent, cap.summary,
    ...(cap.best_for ?? []), ...(cap.scenarios ?? []), ...(cap.selection_cues ?? []),
  ].filter(Boolean).join(' | '));
}

function significantTerms(value) {
  return normalizeText(value).split(' ').filter((t) => t.length >= 4 && !STOPWORDS.has(t));
}

/**
 * Match signals are weighted, not counted. A declared intent is metadata the
 * methodology author committed to; a caller-supplied intent found in an
 * asset's self-description is weaker; a word that merely appears in the
 * dominant-uncertainty prose is weakest, because uncertainty is written as
 * free text and its incidental words collide easily. Counting all three
 * equally lets three incidental collisions outrank a real topical match.
 */
function matchStrength(candidate) {
  return (candidate.matchedIntents?.length ?? 0) * 3
    + (candidate.cueIntents?.length ?? 0) * 2
    + (candidate.cueTerms?.length ?? 0);
}

/**
 * Filtering is metadata-only. The orchestrator is responsible for requiring
 * dominant uncertainty; direct registry callers may omit it. If an asset
 * declares explicit uncertainty_types, they are enforced rather than guessed.
 *
 * Two match bases are reported, never blended: `declared` (the asset's own
 * routing metadata matched) and `cue` (only its self-description matched).
 * A cue match can surface a candidate but can never outrank a declared one.
 */
export function filterCandidates({ intents = [], decisionStage, dominantUncertainty } = {}) {
  const { capabilities = [] } = loadRegistryMetadata();
  const results = [];
  const uncertaintyTerms = significantTerms(dominantUncertainty);

  for (const cap of capabilities) {
    const matchedIntents = (cap.primary_intents ?? []).filter((i) => intents.includes(i));
    const stageMatch = decisionStage ? cap.decision_stage === decisionStage : false;
    const uncertaintyTypes = cap.uncertainty_types ?? null;
    const uncertaintyMatch = uncertaintyTypes && dominantUncertainty
      ? (uncertaintyTypes.includes(dominantUncertainty) ? 'matched' : 'mismatch')
      : 'unknown';

    if (uncertaintyMatch === 'mismatch') continue;

    const corpus = cueCorpus(cap);
    const cueIntents = intents.filter((i) => { const t = normalizeText(i); return t && corpus.includes(t); });
    const cueTerms = uncertaintyTerms.filter((t) => corpus.includes(t));
    const cueHits = [...new Set([...cueIntents, ...cueTerms])];
    const declared = matchedIntents.length > 0 || stageMatch;
    if (!declared && cueHits.length === 0) continue;

    let fit = 'weak_fit';
    if (declared) {
      if (matchedIntents.length > 0 && stageMatch) fit = 'strong_fit';
      else fit = 'fit';
      if (uncertaintyMatch === 'matched' && fit === 'fit') fit = 'strong_fit';
    }

    results.push({
      id: cap.id,
      name: cap.name,
      type: cap.type,
      fit,
      matchBasis: declared ? 'declared' : 'cue',
      matchedIntents,
      cueIntents,
      cueTerms,
      cueHits,
      composes: cap.composes ?? [],
      // Surfaced, not enforced. anti_cues are authored as prose conditions
      // ("the problem itself is not yet established"), so substring-matching
      // them against a query would be pseudo-enforcement that never fires
      // while implying the runtime had screened them. PDM must read and apply
      // them — consistent with treating missing routing semantics as unknown
      // rather than invented.
      antiCues: cap.anti_cues ?? [],
      uncertaintyMatch,
    });
  }

  const fitRank = { strong_fit: 0, fit: 1, weak_fit: 2 };
  const basisRank = { declared: 0, cue: 1 };
  const uncertaintyRank = { matched: 0, unknown: 1, mismatch: 2 };
  results.sort((a, b) =>
    (fitRank[a.fit] - fitRank[b.fit]) ||
    (basisRank[a.matchBasis] - basisRank[b.matchBasis]) ||
    (uncertaintyRank[a.uncertaintyMatch] - uncertaintyRank[b.uncertaintyMatch]) ||
    (matchStrength(b) - matchStrength(a)) ||
    a.id.localeCompare(b.id),
  );
  return results;
}

const TIER_RANK = {
  component: 0, capability: 0, interactive: 1, prompt: 1, workshop: 1, flow: 1, loop: 1,
  advisor: 1, pattern: 1, skeleton: 1, generator: 1, 'market-intelligence': 1, workflow: 2,
};

/**
 * Smallest sufficient entrypoint at the best available fit.
 *
 * "Smallest" only ranks entrypoints that are equally relevant: an entrypoint
 * that barely matched is not *sufficient*, however small it is. So match
 * strength is applied before the tier preference. Ranking by tier alone was
 * safe only while a handful of entrypoints were routable and the best-fit
 * group held one or two members; over a fully routable ecosystem it discards
 * the ranking filterCandidates computed and resolves to whichever small asset
 * sorts first alphabetically.
 *
 * `spansMultipleStages` is a PDM judgment input, not something derived here:
 * when the work unit crosses several decision stages, the composing workflow
 * entrypoint IS the smaller choice, because picking a single component means
 * re-deriving the rest of the sequence by intuition.
 */
export function selectSmallestSufficient(candidates, { spansMultipleStages = false } = {}) {
  if (candidates.length === 0) return null;
  const bestFit = candidates[0].fit;
  const best = candidates.filter((c) => c.fit === bestFit);
  const tier = (c) => {
    const rank = TIER_RANK[c.type] ?? 1;
    return spansMultipleStages ? -rank : rank;
  };
  best.sort((a, b) =>
    (matchStrength(b) - matchStrength(a)) ||
    (tier(a) - tier(b)) ||
    a.id.localeCompare(b.id),
  );
  return best[0];
}

function resolveMethodologyPath(sourceReference) {
  if (typeof sourceReference !== 'string' || !sourceReference.startsWith('methodology/')) {
    throw new Error(`Invalid methodology source reference: ${sourceReference}`);
  }
  const target = path.resolve(__dirname, '..', sourceReference);
  const relative = path.relative(METHODOLOGY_ROOT, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`Methodology path escapes root: ${sourceReference}`);
  return target;
}

export function loadAsset(id) {
  const { assets = [] } = loadRegistryMetadata();
  const meta = assets.find((a) => a.id === id);
  if (!meta) throw new Error(`Unknown methodology asset id: ${id}`);
  return { meta, detail: readFileSync(resolveMethodologyPath(meta.source_reference), 'utf8') };
}

function findCapability(id) {
  const { capabilities = [] } = loadRegistryMetadata();
  return capabilities.find(
    (c) => c.id === id || c.id === `capabilities:${id}` || c.id === `skills:${id}` || c.id === `commands:${id}`,
  ) ?? null;
}

export function loadCapabilityDetail(id) {
  const meta = findCapability(id);
  if (!meta) throw new Error(`Unknown capability id: ${id}`);
  return loadAsset(meta.id);
}

/**
 * Resolves a selected entrypoint's declared composition (`uses:` in the
 * methodology source) into the ordered entrypoints it is built from.
 *
 * Metadata only — this deliberately loads no detail file, so resolving a
 * composition costs nothing in context. PDM decides which members the current
 * work unit actually needs and loads only those via loadCapabilityDetail().
 *
 * `composes` is the declared contract. It is never inferred from an asset's
 * `related_skills`, which is a heuristic cross-reference list and would pull in
 * a skill's "References" section as if it were a dependency.
 */
export function resolveComposition(id) {
  const { capabilities = [] } = loadRegistryMetadata();
  const entry = findCapability(id);
  if (!entry) throw new Error(`Unknown capability id: ${id}`);
  const members = (entry.composes ?? []).map((ref) => {
    const member = findCapability(ref);
    if (!member) {
      throw new Error(
        `Capability "${entry.id}" declares a composition member "${ref}" that is not a registered entrypoint. Rebuild the registry.`,
      );
    }
    return {
      id: member.id,
      name: member.name,
      type: member.type,
      summary: member.summary ?? null,
      source_reference: member.source_reference,
    };
  });
  // Upward direction. Selection legitimately lands on a member entrypoint
  // (e.g. prd-development) rather than the workflow that sequences it, because
  // members carry their own routing metadata. Reporting only the downward
  // direction would let PDM enter a member and re-derive the surrounding
  // sequence by intuition — the exact failure this resolution exists to stop.
  const composedBy = capabilities
    .filter((c) => (c.composes ?? []).includes(entry.id))
    .map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      source_reference: c.source_reference,
      // The sibling members PDM would otherwise miss.
      siblings: (c.composes ?? []).filter((ref) => ref !== entry.id),
    }));

  return {
    entrypoint: { id: entry.id, name: entry.name, type: entry.type, source_reference: entry.source_reference },
    composes: members,
    composed: members.length > 0,
    composedBy,
  };
}

export function listCapabilityIds() {
  return (loadRegistryMetadata().capabilities ?? []).map((c) => c.id);
}

export function listAssets({ type } = {}) {
  const assets = loadRegistryMetadata().assets ?? [];
  return type ? assets.filter((a) => a.type === type) : assets;
}

export { CAPABILITIES_DIR };
