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

export function _resetRegistryCache() { cachedRegistry = null; cachedCorpora = null; }

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
 * An entrypoint's self-description, split by evidential weight rather than
 * lumped together. This IS the ecosystem's routing mechanism: every skill
 * declares these fields, whereas hand-authored primary_intents/decision_stage
 * exist for only a handful and have to be maintained per asset.
 *
 * `scenarios` are verbatim user utterances the author wrote down ("This story
 * is too big for a sprint and splitting by frontend/backend isn't working"),
 * `best_for` are concrete use cases, and `outputs` name the artifacts
 * produced. They are in the same register as a real dominant uncertainty, so a
 * match here is evidence that this entrypoint was written for this situation.
 */
function situationCorpus(cap) {
  return normalizeText([
    ...(cap.scenarios ?? []), ...(cap.best_for ?? []), ...(cap.outputs ?? []),
  ].join(' | '));
}

/** Topical prose. A match here means the right subject area, not the right situation. */
function descriptiveCorpus(cap) {
  return normalizeText([
    cap.name, cap.theme, cap.intent, cap.summary, ...(cap.selection_cues ?? []),
  ].filter(Boolean).join(' | '));
}

let cachedCorpora = null;
function corpora() {
  if (cachedCorpora) return cachedCorpora;
  const { capabilities = [] } = loadRegistryMetadata();
  cachedCorpora = capabilities.map((cap) => ({
    cap, situation: situationCorpus(cap), descriptive: descriptiveCorpus(cap),
  }));
  return cachedCorpora;
}

// A term carries signal only if it distinguishes some entrypoints from the
// rest. "product" appears in nearly every entrypoint's description in a
// product-management corpus, so matching it says nothing — yet it is a long,
// non-stopword word. Let the corpus decide rather than hand-maintaining a list:
// a term present in more than this share of entrypoints is treated as having no
// discriminating power. Two such terms once promoted a SaaS-metrics skill to
// `fit` for a regulatory specification question, on "product" and "deck".
const MAX_DOCUMENT_FREQUENCY = 0.3;

function discriminating(terms) {
  const all = corpora();
  if (all.length === 0) return terms;
  const limit = all.length * MAX_DOCUMENT_FREQUENCY;
  return terms.filter((t) => all.filter((c) => c.situation.includes(t) || c.descriptive.includes(t)).length <= limit);
}

function significantTerms(value) {
  // Deduplicated: a word repeated in the uncertainty prose is one signal, not
  // several. Counting repeats let a single word ("sprint", twice) satisfy the
  // two-distinct-terms threshold that promotes a candidate to `fit`.
  return [...new Set(normalizeText(value).split(' ').filter((t) => t.length >= 4 && !STOPWORDS.has(t)))];
}

/**
 * Match signals are weighted, not counted. Strongest is routing metadata the
 * author wrote for routing; then a caller intent found anywhere in the
 * self-description; then a word matching a declared situation or output; then
 * a word that merely appears in topical prose, which collides easily because a
 * dominant uncertainty is written as free text. Counting them equally lets
 * incidental collisions outrank a real situational match.
 */
function matchStrength(candidate) {
  return (candidate.matchedIntents?.length ?? 0) * 4
    + (candidate.cueIntents?.length ?? 0) * 2
    + (candidate.situationTerms?.length ?? 0) * 2
    + (candidate.descriptiveTerms?.length ?? 0);
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
  const results = [];
  const uncertaintyTerms = discriminating(significantTerms(dominantUncertainty));

  for (const { cap, situation, descriptive } of corpora()) {
    const matchedIntents = (cap.primary_intents ?? []).filter((i) => intents.includes(i));
    const stageMatch = decisionStage ? cap.decision_stage === decisionStage : false;
    const uncertaintyTypes = cap.uncertainty_types ?? null;
    const uncertaintyMatch = uncertaintyTypes && dominantUncertainty
      ? (uncertaintyTypes.includes(dominantUncertainty) ? 'matched' : 'mismatch')
      : 'unknown';

    if (uncertaintyMatch === 'mismatch') continue;

    const cueIntents = intents.filter((i) => {
      const t = normalizeText(i);
      return t && (situation.includes(t) || descriptive.includes(t));
    });
    const situationTerms = uncertaintyTerms.filter((t) => situation.includes(t));
    const descriptiveTerms = uncertaintyTerms.filter((t) => !situation.includes(t) && descriptive.includes(t));
    const cueTerms = [...situationTerms, ...descriptiveTerms];
    const cueHits = [...new Set([...cueIntents, ...cueTerms])];
    const declared = matchedIntents.length > 0 || stageMatch;
    if (!declared && cueHits.length === 0) continue;

    // A caller intent or two distinct uncertainty words landing in the declared
    // situations/outputs means the query resembles a case the author wrote
    // down, which is real evidence of fit — not the loose keyword collision
    // that `weak_fit` is for. Only declared routing metadata reaches
    // strong_fit, so hand-authored disambiguation still wins outright.
    const situationMatch = intents.some((i) => {
      const t = normalizeText(i);
      return t && situation.includes(t);
    }) || situationTerms.length >= 2;

    let fit = 'weak_fit';
    if (declared) {
      if (matchedIntents.length > 0 && stageMatch) fit = 'strong_fit';
      else fit = 'fit';
      if (uncertaintyMatch === 'matched' && fit === 'fit') fit = 'strong_fit';
    } else if (situationMatch) {
      fit = 'fit';
    }

    results.push({
      id: cap.id,
      name: cap.name,
      type: cap.type,
      fit,
      matchBasis: declared ? 'declared' : 'cue',
      matchedIntents,
      cueIntents,
      situationTerms,
      descriptiveTerms,
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

  // Ordered exactly as selectSmallestSufficient resolves, so the candidate list
  // PDM reads agrees with what selection returns. Ranking declared ahead of cue
  // here would print a leader that selection does not pick; the fit ladder
  // already reserves strong_fit for declared routing metadata.
  const fitRank = { strong_fit: 0, fit: 1, weak_fit: 2 };
  const uncertaintyRank = { matched: 0, unknown: 1, mismatch: 2 };
  results.sort((a, b) =>
    (fitRank[a.fit] - fitRank[b.fit]) ||
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
 * Renders a first-pass routing shortlist for a dominant uncertainty, as lines
 * of text — pure and I/O-free, so `bin/pdm-run.mjs` (which cannot be safely
 * imported by tests: it runs its CLI dispatch unconditionally at module load)
 * can print it and tests can assert on it directly.
 *
 * This is the one piece of routing a caller can honestly do without PDM
 * judgment: the dominant uncertainty is already durable Work State, so no
 * judgment is invented by querying with it. `intents`/`decisionStage` are PDM
 * inputs and are deliberately not guessed, which is why this is a shortlist,
 * not a selection.
 *
 * It exists because the decisive signals were previously only reachable by
 * remembering to call a function. A blind test on 2026-09-21 was saved by one
 * anti-cue ("discovery is not yet mature (run prd-readiness-gate first)") that
 * redirected the whole work unit; had the agent not thought to route, it would
 * have produced a confident PRD with an invented persona section. Printing the
 * shortlist and its anti-cues makes that visible at the start of every work
 * unit instead of depending on recall.
 *
 * The scope caveat below exists because a second blind test on 2026-09-24
 * found the shortlist can itself mislead: it is routed against the
 * uncertainty already recorded in Work State — the product's *tracked*
 * problem — not necessarily whatever HH is asking about in the current
 * conversation. Handed an unrelated ad-hoc question, an agent reading an
 * all-weak_fit shortlist computed from that stale, recorded uncertainty
 * nearly concluded "no method applies" to the actual question, which the
 * shortlist was never answering. It caught the mismatch itself; nothing
 * forced that catch. Stated explicitly now so the next reader does not have
 * to rediscover it by nearly making the same mistake.
 *
 * No language detection is attempted when deciding what to say about a weak
 * result: Latin-script proper nouns (Paige, DeepDx) inside an otherwise
 * non-English uncertainty make any such check unreliable, and the instruction
 * is the same either way — supply `intents`, which is where the bridge
 * belongs. This rationale was dropped when the function moved here from
 * bin/pdm-run.mjs in #33 while the behaviour and its output line both stayed.
 *
 * Loads no detail file — metadata only, so it costs no context.
 *
 * @param {string} dominantUncertainty
 * @param {string[]} [routingIntents]
 * @returns {string[]} lines of text; join('\n') to print
 */
export function renderRoutingShortlist(dominantUncertainty, routingIntents = []) {
  if (!dominantUncertainty) {
    return ['', '--- Methodology routing ---', "No dominant uncertainty in this product's Work State; record one before routing."];
  }
  const candidates = filterCandidates({ dominantUncertainty, intents: routingIntents });
  const basis = routingIntents.length
    ? `routing_intents: ${routingIntents.join(', ')}`
    : 'the dominant uncertainty alone';
  const lines = ['', `--- Methodology routing (shortlist from ${basis}) ---`];
  lines.push(
    '  (routed against the uncertainty already on file for this product — if the',
    '  question at hand is different, this shortlist does not answer it. State that',
    "  question's own dominantUncertainty and call selectCapability directly.)",
  );

  const noStrongMatch = candidates.length === 0 || candidates[0].fit === 'weak_fit';

  if (candidates.length === 0) {
    lines.push('  No entrypoint matched. This is no signal, not a weak one.');
    if (routingIntents.length === 0) {
      lines.push(
        "  This product's Work State declares no `routing_intents`. Add them: they are the",
        "  corpus's own terms for this work (e.g. \"competitive\", \"prd\", \"prioritization\"),",
        '  recorded durably so routing does not depend on re-deriving them each session.',
        '  An uncertainty not written in English matches little here; that field is the bridge.',
      );
    } else {
      lines.push(
        '  Even with routing_intents, nothing matched — the declared intents may not be the',
        "  corpus's terms. Check them against `filterCandidates` before widening the search.",
      );
    }
    return lines;
  }
  for (const c of candidates.slice(0, 5)) {
    lines.push(`  ${c.fit.padEnd(10)} ${c.matchBasis.padEnd(9)} ${(c.type ?? '').padEnd(11)} ${c.id}`);
  }
  if (candidates.length > 5) lines.push(`  ... ${candidates.length - 5} more`);
  if (noStrongMatch) {
    lines.push('', '  Nothing above weak_fit: a starting point, not a selection.');
    if (routingIntents.length === 0) {
      lines.push(
        "  Declaring `routing_intents` in this product's Work State would give routing the",
        "  corpus's own terms instead of whatever its prose happens to share with English.",
      );
    }
  }

  const top = candidates[0];
  if (top.antiCues?.length) {
    lines.push('', `  Anti-cues on ${top.id} — if one of these holds, it is the wrong entrypoint:`);
    for (const cue of top.antiCues) lines.push(`    - ${cue}`);
  }
  const { composes, composedBy } = resolveComposition(top.id);
  if (composes.length) {
    lines.push('', `  ${top.id} composes: ${composes.map((m) => m.id).join(', ')}`);
  }
  for (const parent of composedBy) {
    lines.push('', `  ${top.id} is a member of ${parent.id}, alongside: ${parent.siblings.join(', ')}`);
  }
  return lines;
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
