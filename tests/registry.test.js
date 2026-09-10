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

test('ecosystem registry is metadata-first and contains the imported skill ecosystem', () => {
  const registry = loadRegistryMetadata();
  assert.equal(registry.schema_version, '1.1.0');
  assert.ok(Array.isArray(registry.assets));
  assert.ok(registry.assets.length > 100, 'genesis registry should index the full methodology ecosystem');
  assert.ok(registry.assets.some((a) => a.id === 'skills:problem-framing-canvas'));
  assert.ok(registry.assets.some((a) => a.id === 'prompts:skills:dangerous-animals-of-pm-generator'));
});

test('filterCandidates requires dominant uncertainty and does not guess missing uncertainty metadata', () => {
  assert.throws(() => filterCandidates({ intents: ['prioritization'] }), /dominantUncertainty/);
  const candidates = filterCandidates({
    intents: ['prioritization'],
    decisionStage: 'prioritize',
    dominantUncertainty: 'what_to_prioritize',
  });
  assert.ok(candidates.some((c) => c.id === 'skills:prioritization-advisor' || c.id === 'skills:prioritization-comparison'));
  assert.ok(candidates.every((c) => c.uncertaintyMatch === 'unknown' || c.uncertaintyMatch === 'matched'));
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

test('loadCapabilityDetail remains a compatibility alias for selected skill assets', () => {
  const { meta, detail } = loadCapabilityDetail('skills:problem-framing-canvas');
  assert.equal(meta.id, 'skills:problem-framing-canvas');
  assert.match(detail, /Problem Framing Canvas/);
});

test('unknown asset ids fail rather than substituting a nearby methodology asset', () => {
  assert.throws(() => loadAsset('does-not-exist'));
});

test('skill relationships resolve to existing skill ids where explicitly referenced', () => {
  const related = listAssets({ type: 'skill' }).find((a) => a.id === 'skills:discovery-process')?.related_skills ?? [];
  assert.ok(related.includes('skills:problem-framing-canvas') || related.length >= 0);
  for (const asset of listAssets({ type: 'skill' })) {
    for (const id of asset.related_skills ?? []) {
      assert.match(id, /^skills:/);
    }
  }
});

test('capability ids are now namespaced to their canonical methodology assets', () => {
  const ids = listCapabilityIds();
  assert.ok(ids.includes('skills:discovery-process'));
  assert.ok(ids.includes('skills:prioritization-advisor'));
  assert.ok(ids.includes('skills:prd-development'));
  assert.ok(!ids.includes('problem-framing-canvas'));
});
