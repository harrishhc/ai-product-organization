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

test('cue matching surfaces undeclared entrypoints but never outranks declared routing', () => {
  const candidates = filterCandidates({
    intents: ['prioritization'],
    decisionStage: 'prioritize',
    dominantUncertainty: 'which option to sequence first',
  });
  const declared = candidates.filter((c) => c.matchBasis === 'declared');
  const cued = candidates.filter((c) => c.matchBasis === 'cue');
  assert.ok(declared.length > 0);
  assert.ok(cued.length > 0, 'self-described entrypoints should now be reachable');
  for (const c of cued) assert.equal(c.fit, 'weak_fit');
  // Ordering: every declared candidate precedes every cue-only candidate.
  const firstCue = candidates.findIndex((c) => c.matchBasis === 'cue');
  assert.ok(candidates.slice(0, firstCue).every((c) => c.matchBasis === 'declared'));
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
