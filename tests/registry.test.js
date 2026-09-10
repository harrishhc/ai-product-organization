import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  filterCandidates,
  selectSmallestSufficient,
  loadAsset,
  loadCapabilityDetail,
  listAssets,
  listCapabilityIds,
  loadRegistryMetadata,
} from '../runtime/registry.js';
import { createSession } from '../runtime/instrumentation.js';

test('ecosystem registry is metadata-first and contains the imported ecosystem', () => {
  const registry = loadRegistryMetadata();
  assert.equal(registry.schema_version, '1.3.0');
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
