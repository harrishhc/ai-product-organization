import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDecision, setRecommendation, recordFounderDecision, transition, appendRecord } from '../runtime/decision.js';

test('createDecision starts in IDEA with empty decision-protocol fields', () => {
  const d = createDecision({ context: 'ctx', problem: 'problem statement' });
  assert.equal(d.state, 'IDEA');
  assert.deepEqual(d.evidence, []);
  assert.equal(d.recommendation, null);
  assert.equal(d.founder_decision, null);
});

test('illegal transitions are rejected', () => {
  const d = createDecision({ context: 'ctx', problem: 'p' });
  assert.throws(() => transition(d, 'EXECUTION'));
});

test('setRecommendation moves to RECOMMENDATION and records confidence', () => {
  let d = createDecision({ context: 'ctx', problem: 'p' });
  d = transition(d, 'FRAMING');
  d = setRecommendation(d, { recommendation: 'ship_a', confidence: 'medium', alternatives: ['ship_a', 'do_nothing'] });
  assert.equal(d.state, 'RECOMMENDATION');
  assert.equal(d.recommendation, 'ship_a');
  assert.equal(d.confidence, 'medium');
});

test('recordFounderDecision keeps recommendation and founder_decision distinct, even on override', () => {
  let d = createDecision({ context: 'ctx', problem: 'p' });
  d = transition(d, 'FRAMING');
  d = setRecommendation(d, { recommendation: 'do_not_build', confidence: 'high' });

  d = recordFounderDecision(d, { hhDecision: 'build_now', isOverride: true });

  assert.equal(d.recommendation, 'do_not_build', 'PDM recommendation must not be overwritten by HH decision');
  assert.equal(d.founder_decision.hhDecision, 'build_now');
  assert.equal(d.founder_decision.overridden, true);
  assert.equal(d.state, 'EXECUTION');
});

test('recordFounderDecision cannot run before a recommendation exists', () => {
  const d = createDecision({ context: 'ctx', problem: 'p' });
  assert.throws(() => recordFounderDecision(d, { hhDecision: 'anything' }));
});

test('a founder "dont_build_yet" decision halts execution', () => {
  let d = createDecision({ context: 'ctx', problem: 'p' });
  d = transition(d, 'FRAMING');
  d = setRecommendation(d, { recommendation: 'build_it', confidence: 'low' });
  d = recordFounderDecision(d, { hhDecision: 'dont_build_yet' });
  assert.equal(d.state, 'HALTED');
});

test('appendRecord preserves history for later evaluation', () => {
  let d = createDecision({ context: 'ctx', problem: 'p' });
  d = appendRecord(d, 'assumed X because Y');
  assert.equal(d.record.length, 1);
  assert.equal(d.record[0].note, 'assumed X because Y');
});
