import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterCandidates, selectSmallestSufficient, loadCapabilityDetail, listCapabilityIds } from '../runtime/registry.js';
import { createSession } from '../runtime/instrumentation.js';

test('filterCandidates matches by intent without requiring a decision stage', () => {
  const candidates = filterCandidates({ intents: ['prioritization'] });
  assert.ok(candidates.some((c) => c.id === 'prioritization-comparison'));
});

test('filterCandidates ranks strong_fit (intent + stage) above weak_fit', () => {
  const candidates = filterCandidates({ intents: ['prd', 'execution_gate'], decisionStage: 'validate' });
  assert.equal(candidates[0].id, 'prd-readiness-gate');
  assert.equal(candidates[0].fit, 'strong_fit');
});

test('filterCandidates returns nothing for an intent no capability declares', () => {
  const candidates = filterCandidates({ intents: ['nonexistent_intent_xyz'] });
  assert.equal(candidates.length, 0);
});

test('selectSmallestSufficient prefers component over workflow at equal fit', () => {
  const candidates = [
    { id: 'a', name: 'A', type: 'workflow', fit: 'fit', matchedIntents: ['x'] },
    { id: 'b', name: 'B', type: 'component', fit: 'fit', matchedIntents: ['x'] },
  ];
  assert.equal(selectSmallestSufficient(candidates).id, 'b');
});

test('loadCapabilityDetail lazily loads exactly the requested capability, not the whole registry', () => {
  const session = createSession();
  const { selected } = { selected: filterCandidates({ intents: ['problem_framing'] })[0] };
  assert.equal(session.summary().capabilityDetailLoads, 0, 'no detail loaded merely by filtering candidates');

  const { meta, detail } = loadCapabilityDetail(selected.id);
  session.recordCapabilityDetailLoad(selected.id, detail);

  assert.equal(meta.id, 'problem-framing-canvas');
  assert.match(detail, /Problem Framing Canvas/);
  assert.equal(session.summary().capabilityDetailLoads, 1, 'exactly one detail file was loaded, not all capabilities');
  assert.ok(listCapabilityIds().length > 1, 'sanity: the registry has more than one capability available');
});

test('loadCapabilityDetail throws for an unknown id rather than substituting a nearby one', () => {
  assert.throws(() => loadCapabilityDetail('does-not-exist'));
});

test('the four imported (dean-product-manager-skills) capabilities load and carry provenance', () => {
  for (const id of ['problem-framing-canvas', 'discovery-process', 'prioritization-advisor', 'prd-development']) {
    const { meta, detail } = loadCapabilityDetail(id);
    assert.equal(meta.source, 'dean-product-manager-skills');
    assert.equal(meta.provenance.upstream_repository, 'https://github.com/deanpeters/Product-Manager-Skills');
    assert.ok(meta.provenance.commit, `${id} provenance is missing a commit`);
    assert.ok(detail.includes('HH Methodology — Adapted Capability'), `${id} detail is missing the HH provenance header`);
  }
});

test('imported capabilities sit alongside, not instead of, their HH-original counterparts', () => {
  const ids = listCapabilityIds();
  // Pairs that are deliberately complementary rather than duplicates.
  assert.ok(ids.includes('discovery-question-set') && ids.includes('discovery-process'));
  assert.ok(ids.includes('prioritization-comparison') && ids.includes('prioritization-advisor'));
  assert.ok(ids.includes('prd-readiness-gate') && ids.includes('prd-development'));
});

test('existing narrow queries still resolve to the original HH-original capability, unaffected by the added imports', () => {
  // prioritization-advisor uses a distinct decision_stage so it does not tie
  // with prioritization-comparison for this exact (intents, decisionStage) query.
  const candidates = filterCandidates({ intents: ['prioritization'], decisionStage: 'prioritize' });
  assert.equal(selectSmallestSufficient(candidates).id, 'prioritization-comparison');
});
