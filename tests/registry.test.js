import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  filterCandidates,
  selectSmallestSufficient,
  resolveComposition,
  loadAsset,
  loadCapabilityDetail,
  listAssets,
  listCapabilityIds,
  loadRegistryMetadata,
  renderRoutingShortlist,
} from '../runtime/registry.js';
import { createSession } from '../runtime/instrumentation.js';

test('ecosystem registry is metadata-first and contains the imported ecosystem', () => {
  const registry = loadRegistryMetadata();
  assert.equal(registry.schema_version, '1.4.0');
  assert.ok(Array.isArray(registry.assets));
  assert.ok(registry.assets.length > 100, 'genesis registry should index the full methodology ecosystem');
  assert.ok(registry.assets.some((a) => a.id === 'skills:problem-framing-canvas'));
  assert.ok(registry.assets.some((a) => a.id === 'prompts:skills:dangerous-animals-of-pm-generator'));
  assert.ok(registry.assets.some((a) => a.id === 'capabilities:discovery-question-set'));
});

test('filterCandidates may be used directly without uncertainty, but enforces explicit uncertainty metadata when declared', () => {
  const direct = filterCandidates({ intents: ['prioritization'], decisionStage: 'prioritize' });
  assert.ok(direct.some((c) => c.id === 'capabilities:prioritization-comparison'));

  const routed = filterCandidates({
    intents: ['prioritization'],
    decisionStage: 'prioritize',
    dominantUncertainty: 'what_to_prioritize',
  });
  assert.ok(routed.some((c) => c.id === 'capabilities:prioritization-comparison'));
  assert.ok(routed.every((c) => c.uncertaintyMatch === 'unknown' || c.uncertaintyMatch === 'matched'));
});

test('selectSmallestSufficient prefers a smaller capability at equal fit', () => {
  const candidates = [
    { id: 'a', name: 'A', type: 'workflow', fit: 'fit', matchedIntents: ['x'] },
    { id: 'b', name: 'B', type: 'component', fit: 'fit', matchedIntents: ['x'] },
  ];
  assert.equal(selectSmallestSufficient(candidates).id, 'b');
});

test('loadAsset lazily loads exactly the selected asset', () => {
  const session = createSession();
  const selected = filterCandidates({
    intents: ['problem_framing'],
    decisionStage: 'framing',
    dominantUncertainty: 'problem_definition',
  }).find((c) => c.id === 'skills:problem-framing-canvas');
  assert.ok(selected);
  assert.equal(session.summary().capabilityDetailLoads, 0);

  const { meta, detail } = loadAsset(selected.id);
  session.recordCapabilityDetailLoad(selected.id, detail);
  assert.equal(meta.id, 'skills:problem-framing-canvas');
  assert.match(detail, /Problem Framing Canvas/);
  assert.equal(session.summary().capabilityDetailLoads, 1);
});

test('loadCapabilityDetail accepts canonical and legacy ids', () => {
  const canonical = loadCapabilityDetail('skills:problem-framing-canvas');
  assert.equal(canonical.meta.id, 'skills:problem-framing-canvas');
  assert.match(canonical.detail, /Problem Framing Canvas/);

  const legacy = loadCapabilityDetail('discovery-question-set');
  assert.equal(legacy.meta.id, 'capabilities:discovery-question-set');
});

test('unknown asset ids fail rather than substituting a nearby methodology asset', () => {
  assert.throws(() => loadAsset('does-not-exist'));
});

test('skill relationships resolve only to existing skill ids', () => {
  for (const asset of listAssets({ type: 'skill' })) {
    for (const id of asset.related_skills ?? []) {
      assert.match(id, /^skills:/);
      assert.ok(listAssets({ type: 'skill' }).some((candidate) => candidate.id === id));
    }
  }
});

test('capability ids are canonical methodology asset ids', () => {
  const ids = listCapabilityIds();
  assert.ok(ids.includes('skills:discovery-process'));
  assert.ok(ids.includes('skills:prioritization-advisor'));
  assert.ok(ids.includes('skills:prd-development'));
  assert.ok(ids.includes('capabilities:discovery-question-set'));
  assert.ok(ids.includes('capabilities:prioritization-comparison'));
  assert.ok(!ids.includes('problem-framing-canvas'));
});

test('capabilities[] holds only methodology entrypoints, not their examples or templates', () => {
  const registry = loadRegistryMetadata();
  for (const cap of registry.capabilities) {
    assert.doesNotMatch(cap.id, /:(examples?|template)(:|$)/, `${cap.id} is supporting material, not an entrypoint`);
    const asset = registry.assets.find((a) => a.id === cap.id);
    assert.ok(asset?.entrypoint, `${cap.id} is routable but not marked as an entrypoint asset`);
  }
  // Supporting material stays indexed as an asset, just not selectable.
  assert.ok(registry.assets.some((a) => a.id === 'skills:ansoff-matrix:template' && a.entrypoint === false));
});

test('all three entrypoint tiers are routable, including the composing commands', () => {
  const registry = loadRegistryMetadata();
  const tiers = new Set(registry.capabilities.map((c) => c.type));
  for (const tier of ['workflow', 'interactive', 'component']) {
    assert.ok(tiers.has(tier), `no ${tier} entrypoint is routable`);
  }
  const ids = registry.capabilities.map((c) => c.id);
  assert.ok(ids.includes('commands:write-prd'), 'command workflows must be selectable entrypoints');
  assert.ok(ids.includes('commands:discover'));
});

test('block-scalar frontmatter is folded, not captured as its block indicator', () => {
  const registry = loadRegistryMetadata();
  assert.equal(registry.assets.filter((a) => a.intent === '>-' || a.intent === '|').length, 0);
  const problemStatement = registry.assets.find((a) => a.id === 'skills:problem-statement');
  assert.match(problemStatement.intent, /problem from the user's perspective/);
});

test('self-description routing reaches fit on a situational match, but only declared metadata reaches strong_fit', () => {
  const candidates = filterCandidates({
    intents: ['prioritization'],
    decisionStage: 'prioritize',
    dominantUncertainty: 'which option to sequence first',
  });
  assert.ok(candidates.some((c) => c.matchBasis === 'declared'));
  assert.ok(candidates.some((c) => c.matchBasis === 'cue'), 'self-described entrypoints must be reachable');
  // Hand-authored routing metadata keeps an exclusive top tier: it is the only
  // place disambiguation knowledge ("use prioritization-advisor first") lives.
  for (const c of candidates.filter((c) => c.matchBasis === 'cue')) {
    assert.notEqual(c.fit, 'strong_fit');
  }
  for (const c of candidates.filter((c) => c.fit === 'strong_fit')) {
    assert.equal(c.matchBasis, 'declared');
  }
});

test('a verbatim scenario match ranks as fit, not as a loose keyword collision', () => {
  // user-story-splitting declares the scenario "This story is too big for a
  // sprint and splitting by frontend/backend isn't working".
  const candidates = filterCandidates({
    dominantUncertainty: 'this story is too big for a sprint and splitting by frontend backend is not working',
  });
  const splitting = candidates.find((c) => c.id === 'skills:user-story-splitting');
  assert.ok(splitting, 'the entrypoint written for this situation must be reachable');
  assert.equal(splitting.fit, 'fit');
  assert.ok(splitting.situationTerms.length >= 2, 'the match must come from declared scenarios/best_for');
  assert.equal(candidates[0].id, 'skills:user-story-splitting');
});

test('a situational match outranks a same-tier topical-prose match', () => {
  const [top] = filterCandidates({ dominantUncertainty: 'stakeholder wants a dashboard', intents: ['feature'] });
  assert.equal(top.id, 'skills:incoming-request-advisor');
  assert.ok(top.situationTerms.includes('dashboard'));
});

test('candidate order agrees with what selection resolves', () => {
  for (const query of [
    { intents: ['prd'], decisionStage: 'document', dominantUncertainty: 'no engineering-ready requirements document' },
    { intents: ['feature'], decisionStage: 'framing', dominantUncertainty: 'stakeholder wants a dashboard' },
    { intents: ['competitive'], dominantUncertainty: 'a competitor cut pricing and we must respond' },
  ]) {
    const candidates = filterCandidates(query);
    assert.equal(selectSmallestSufficient(candidates).id, candidates[0].id, JSON.stringify(query));
  }
});

test('an entrypoint with no declared and no cue match is not returned', () => {
  const candidates = filterCandidates({ intents: ['zzqqx_nonexistent_intent'], dominantUncertainty: 'zzqqx' });
  assert.equal(candidates.length, 0);
});

test('selectSmallestSufficient prefers the composing workflow when work spans stages', () => {
  const candidates = [
    { id: 'a', name: 'A', type: 'workflow', fit: 'fit' },
    { id: 'b', name: 'B', type: 'component', fit: 'fit' },
  ];
  assert.equal(selectSmallestSufficient(candidates).id, 'b');
  assert.equal(selectSmallestSufficient(candidates, { spansMultipleStages: true }).id, 'a');
});

test('resolveComposition returns the declared uses: chain as metadata only', () => {
  const session = createSession();
  const { entrypoint, composes, composed } = resolveComposition('commands:write-prd');
  assert.equal(entrypoint.id, 'commands:write-prd');
  assert.equal(composed, true);
  assert.deepEqual(composes.map((c) => c.id), [
    'skills:prd-development',
    'skills:problem-statement',
    'skills:proto-persona',
    'skills:user-story',
    'skills:user-story-splitting',
  ]);
  for (const member of composes) {
    assert.ok(member.source_reference.startsWith('methodology/'));
    assert.ok(!('detail' in member), 'composition resolution must stay metadata-only');
  }
  assert.equal(session.summary().capabilityDetailLoads, 0);
});

test('resolveComposition does not fall back to heuristic related_skills', () => {
  // problem-statement cross-references other skills in its References section;
  // those are not dependencies and must not appear as a composition.
  const registry = loadRegistryMetadata();
  const asset = registry.assets.find((a) => a.id === 'skills:problem-statement');
  assert.ok(asset.related_skills.length > 0);
  const { composes, composed } = resolveComposition('skills:problem-statement');
  assert.deepEqual(composes, []);
  assert.equal(composed, false);
});

test('every declared composition member resolves to a registered entrypoint', () => {
  const registry = loadRegistryMetadata();
  for (const cap of registry.capabilities) {
    assert.doesNotThrow(() => resolveComposition(cap.id), `${cap.id} has an unresolvable composition`);
  }
});

test('resolveComposition reports upward membership so a member entrypoint carries its sequence', () => {
  // prd-development is the entrypoint routing actually selects for PRD work,
  // but the composition is declared on /write-prd. Without the upward
  // direction, PDM enters prd-development with no signal that problem framing,
  // personas, and stories belong to the same work unit.
  const { composes, composedBy } = resolveComposition('skills:prd-development');
  assert.deepEqual(composes, []);
  assert.equal(composedBy.length, 1);
  assert.equal(composedBy[0].id, 'commands:write-prd');
  assert.deepEqual(composedBy[0].siblings, [
    'skills:problem-statement',
    'skills:proto-persona',
    'skills:user-story',
    'skills:user-story-splitting',
  ]);
  assert.ok(!composedBy[0].siblings.includes('skills:prd-development'), 'an entrypoint is not its own sibling');
});

test('an entrypoint can belong to more than one composition', () => {
  const { composedBy } = resolveComposition('skills:problem-statement');
  const ids = composedBy.map((c) => c.id);
  assert.ok(ids.includes('commands:write-prd'));
  assert.ok(ids.includes('commands:strategy'));
});

test('selectSmallestSufficient ranks match strength before the tier preference', () => {
  // Regression: ranking by tier first resolved a large best-fit group to
  // whichever small asset sorted first alphabetically, discarding the ranking
  // filterCandidates had already computed.
  const candidates = [
    { id: 'aardvark-weak', name: 'W', type: 'component', fit: 'weak_fit', cueIntents: [], cueTerms: ['x'] },
    { id: 'zebra-strong', name: 'S', type: 'workflow', fit: 'weak_fit', cueIntents: ['topic'], cueTerms: ['x', 'y'] },
  ];
  assert.equal(selectSmallestSufficient(candidates).id, 'zebra-strong');
});

test('a declared intent outweighs incidental uncertainty-prose collisions', () => {
  const declaredMatch = { id: 'a', type: 'component', fit: 'fit', matchedIntents: ['prd'], cueIntents: [], cueTerms: [] };
  const prosePileup = { id: 'b', type: 'component', fit: 'fit', matchedIntents: [], cueIntents: [], cueTerms: ['x', 'y'] };
  assert.equal(selectSmallestSufficient([declaredMatch, prosePileup]).id, 'a');
});

test('cue hits are reported by provenance, not as one undifferentiated count', () => {
  const [top] = filterCandidates({
    intents: ['competitive'],
    dominantUncertainty: 'a competitor cut pricing and we must respond',
  });
  assert.ok(Array.isArray(top.cueIntents));
  assert.ok(Array.isArray(top.cueTerms));
  assert.deepEqual(top.cueHits, [...new Set([...top.cueIntents, ...top.cueTerms])]);
});

test('anti_cues are surfaced on candidates rather than silently enforced', () => {
  const candidates = filterCandidates({ intents: ['prioritization'], decisionStage: 'prioritize' });
  const cap = candidates.find((c) => c.id === 'capabilities:prioritization-comparison');
  assert.ok(cap.antiCues.length > 0, 'declared anti-cues must reach PDM');
  // They are prose conditions, not machine-matchable terms: a query that
  // states an anti-cue almost verbatim must still return the candidate, so
  // the runtime never pretends to have screened a judgment it cannot make.
  const stated = filterCandidates({
    intents: ['prioritization'],
    decisionStage: 'prioritize',
    dominantUncertainty: 'only one viable option exists',
  });
  assert.ok(stated.some((c) => c.id === 'capabilities:prioritization-comparison'));
});

test('a term appearing across most of the corpus carries no signal', () => {
  // "product" is in nearly every entrypoint's description in a
  // product-management corpus. Regression: two such words ("product", "deck")
  // once promoted a SaaS-metrics skill to `fit` for a regulatory
  // specification question.
  const candidates = filterCandidates({
    dominantUncertainty: 'the Product Deck reports an internal AUC far above external deployment concordance',
  });
  for (const c of candidates) {
    assert.ok(!c.situationTerms.includes('product'), '"product" must be filtered as non-discriminating');
    assert.ok(!c.descriptiveTerms.includes('product'), '"product" must be filtered as non-discriminating');
  }
  // Surfacing at weak_fit on one incidental word is honest; being selected is not.
  const saas = candidates.filter((c) => c.id.startsWith('skills:saas-'));
  for (const c of saas) {
    assert.equal(c.fit, 'weak_fit', `${c.id} must not reach fit on corpus-generic words`);
  }
  assert.ok(
    !selectSmallestSufficient(candidates).id.startsWith('skills:saas-'),
    'a SaaS metrics skill must not be selected for a model-accuracy question',
  );
});

test('a repeated word in the uncertainty is one signal, not several', () => {
  // Regression: situationTerms counted duplicates, so a single word appearing
  // twice satisfied the two-distinct-terms threshold that promotes to `fit`.
  const [top] = filterCandidates({
    dominantUncertainty: 'the sprint is blocked and the sprint cannot close until sprint config is defined',
  });
  if (top) {
    assert.equal(new Set(top.situationTerms).size, top.situationTerms.length, 'situationTerms must be deduplicated');
    assert.equal(new Set(top.cueTerms).size, top.cueTerms.length, 'cueTerms must be deduplicated');
  }
});

test('an uncertainty in another language yields no match rather than a confident wrong one', () => {
  // The methodology corpus is English. The portfolio's work state is written in
  // Traditional Chinese, so this is the real case, not a hypothetical: routing
  // must return nothing rather than rank on incidental Latin-script tokens.
  const candidates = filterCandidates({
    dominantUncertainty: '市場調查/競品分析尚未開始 —— 這是全新產品，目標客群缺乏系統性分析。',
  });
  assert.equal(candidates.length, 0);

  // Supplying intents in the corpus's terms is the bridge, and it works.
  const routed = filterCandidates({ intents: ['competitive'], dominantUncertainty: 'competitive positioning is unknown' });
  assert.ok(routed.length > 0);
  assert.ok(routed.some((c) => c.id === 'skills:battle-card-builder' || c.id === 'skills:competitive-research-snapshot'));
});

test('renderRoutingShortlist states its own scope so a stale shortlist cannot be read as "no method applies"', () => {
  // Regression: a blind test on 2026-09-24 gave a fresh agent an ad-hoc
  // question unrelated to a product's recorded Work State uncertainty. The
  // shortlist computed from that stale uncertainty came back all weak_fit,
  // and the agent nearly concluded no methodology applied to the actual
  // question — which this shortlist was never answering. It caught the
  // mismatch itself; nothing in the output forced that catch. The scope
  // caveat below is what now forces it.
  const lines = renderRoutingShortlist('a question unrelated to any entrypoint keyword whatsoever');
  const text = lines.join('\n');
  assert.match(text, /routed against the uncertainty already on file/);
  assert.match(text, /if the.*question at hand is different.*does not answer it/s);
  assert.match(text, /State that.*dominantUncertainty and call selectCapability directly/s);
});

test('renderRoutingShortlist reproduces the blind-test shape: several weak_fit, no strong match', () => {
  // Synthetic rather than a live product's exact Work State text, which is
  // someone else's changeable data, not durable test fixture. This string is
  // chosen because it independently reproduces the shape found in the
  // blind test: a handful of cue-only weak_fit hits and nothing stronger —
  // the exact condition the scope caveat above must fire for.
  const lines = renderRoutingShortlist('the deck reported a figure');
  const text = lines.join('\n');
  assert.match(text, /weak_fit/);
  assert.match(text, /Nothing above weak_fit: a starting point, not a selection/);
  assert.doesNotMatch(text, /\bstrong_fit\b/);
  assert.doesNotMatch(text, /^\s+fit\s/m);
});

test('renderRoutingShortlist surfaces anti-cues and composition for a real match, without loading any detail', () => {
  const lines = renderRoutingShortlist('discovery notes exist but no engineering-ready requirements document', undefined);
  const text = lines.join('\n');
  assert.match(text, /skills:prd-development/);
});
