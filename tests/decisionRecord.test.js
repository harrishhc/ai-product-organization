import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadProductContext, writeProductContext } from '../runtime/context.js';
import { createDecision, setRecommendation, recordFounderDecision } from '../runtime/decision.js';
import {
  toDecisionRecord,
  upsertDecisionRecord,
  listPendingCheckpoints,
  isAwaitingFounder,
  PENDING_STATE,
} from '../runtime/decisionRecord.js';

const FIXTURE = '_decision-fixture';

function pendingDecision() {
  const d = createDecision({ context: 'c', problem: 'Which wedge first?' });
  return setRecommendation({ ...d, state: 'FRAMING' }, {
    recommendation: 'Throughput wedge',
    confidence: 'medium',
    alternatives: ['accuracy wedge'],
    risks: ['pathologist adoption'],
  });
}

/** Every test restores the checked-in fixture so the suite has no lasting side effect. */
async function withFixture(fn) {
  const original = loadProductContext(FIXTURE);
  try {
    await fn();
  } finally {
    writeProductContext(FIXTURE, original);
  }
}

test('a pending recommendation makes no "DECISION" classification claim', () => {
  const record = toDecisionRecord(pendingDecision());
  assert.equal(record.state, PENDING_STATE);
  assert.ok(!('classification' in record), 'a proposal awaiting HH must not be labelled DECISION');
  assert.equal(record.founder_decision, null);
});

test('a resolved decision does claim the DECISION classification', () => {
  const resolved = recordFounderDecision(pendingDecision(), { hhDecision: 'Throughput wedge' });
  const record = toDecisionRecord(resolved);
  assert.equal(record.classification, 'DECISION');
  assert.notEqual(record.founder_decision, null);
});

test('the record projects away the session trail but keeps what evaluation needs', () => {
  const record = toDecisionRecord(pendingDecision());
  assert.ok(!('history' in record), 'history is a transcript, not durable product context');
  assert.ok(!('record' in record));
  assert.deepEqual(record.alternatives, ['accuracy wedge']);
  assert.deepEqual(record.risks, ['pathologist adoption']);
  assert.equal(record.confidence, 'medium');
});

test('toDecisionRecord refuses anything that is not a decision.js object', () => {
  assert.throws(() => toDecisionRecord({ recommendation: 'x' }), /requires a decision object/);
});

test('a pending checkpoint survives into Product Context and is discoverable', async () => {
  await withFixture(() => {
    const result = upsertDecisionRecord(FIXTURE, pendingDecision());
    assert.equal(result.pending, true);

    const pending = listPendingCheckpoints(FIXTURE);
    assert.equal(pending.length, 1);
    assert.equal(pending[0].recommendation, 'Throughput wedge');
    assert.equal(isAwaitingFounder(FIXTURE), true);
  });
});

test('resolving a checkpoint updates the same record rather than appending a duplicate', async () => {
  await withFixture(() => {
    const pending = pendingDecision();
    upsertDecisionRecord(FIXTURE, pending);
    const resolved = recordFounderDecision(pending, { hhDecision: 'accuracy wedge', isOverride: true });
    upsertDecisionRecord(FIXTURE, resolved);

    const { decisions } = loadProductContext(FIXTURE);
    assert.equal(decisions.length, 1, 'one decision, one row — its state moves');
    assert.equal(decisions[0].id, pending.id);
    assert.notEqual(decisions[0].state, PENDING_STATE);
    assert.equal(isAwaitingFounder(FIXTURE), false, 'the product is no longer waiting on HH');
  });
});

test('an override keeps PDM recommendation and HH decision permanently distinct once persisted', async () => {
  await withFixture(() => {
    const pending = pendingDecision();
    const resolved = recordFounderDecision(pending, { hhDecision: 'accuracy wedge', isOverride: true });
    upsertDecisionRecord(FIXTURE, resolved);

    const [record] = loadProductContext(FIXTURE).decisions;
    assert.equal(record.recommendation, 'Throughput wedge');
    assert.equal(record.founder_decision.hhDecision, 'accuracy wedge');
    assert.equal(record.founder_decision.overridden, true);
  });
});

test('recorded_at is preserved across updates while updated_at moves', async () => {
  await withFixture(() => {
    const pending = pendingDecision();
    upsertDecisionRecord(FIXTURE, pending);
    const firstRecordedAt = loadProductContext(FIXTURE).decisions[0].recorded_at;

    upsertDecisionRecord(FIXTURE, recordFounderDecision(pending, { hhDecision: 'Throughput wedge' }));
    const [record] = loadProductContext(FIXTURE).decisions;
    assert.equal(record.recorded_at, firstRecordedAt, 'when the checkpoint was first raised must not drift');
  });
});

test('listPendingCheckpoints reads one bounded section, and tolerates a product with no decisions yet', () => {
  assert.deepEqual(listPendingCheckpoints('_template'), []);
  assert.equal(isAwaitingFounder('_template'), false);
});
