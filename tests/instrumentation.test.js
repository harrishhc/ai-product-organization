import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession, STOP_REASONS } from '../runtime/instrumentation.js';

test('an unbudgeted session always allows the loop to continue', () => {
  const session = createSession();
  session.recordWorkItem('a');
  session.recordToolCall('b');
  assert.deepEqual(session.shouldContinue(), { canContinue: true, reason: null });
});

test('the injected usage signal outranks every self-imposed ceiling', () => {
  const session = createSession({ budget: { maxWorkItems: 100, isExhausted: () => true } });
  const { canContinue, reason } = session.shouldContinue();
  assert.equal(canContinue, false);
  assert.equal(reason, STOP_REASONS.EXTERNAL_USAGE_EXHAUSTED);
});

test('work item ceiling stops the loop once reached, not before', () => {
  const session = createSession({ budget: { maxWorkItems: 2 } });
  assert.equal(session.shouldContinue().canContinue, true);
  session.recordWorkItem('one');
  assert.equal(session.shouldContinue().canContinue, true);
  session.recordWorkItem('two');
  assert.deepEqual(session.shouldContinue(), { canContinue: false, reason: STOP_REASONS.WORK_ITEMS_EXHAUSTED });
});

test('estimated-token ceiling is a self-imposed heuristic, and reports itself as such', () => {
  const session = createSession({ budget: { maxEstimatedTokens: 10 } });
  session.addEstimatedTokens('x'.repeat(80)); // chars/4 => 20
  assert.deepEqual(session.shouldContinue(), { canContinue: false, reason: STOP_REASONS.ESTIMATED_TOKENS_EXHAUSTED });
});

test('tool-call ceiling stops the loop', () => {
  const session = createSession({ budget: { maxToolCalls: 1 } });
  session.recordToolCall('a');
  assert.deepEqual(session.shouldContinue(), { canContinue: false, reason: STOP_REASONS.TOOL_CALLS_EXHAUSTED });
});

test('workItems appears in the summary so a stopped run can report why', () => {
  const session = createSession({ budget: { maxWorkItems: 5 } });
  session.recordWorkItem('one');
  assert.equal(session.summary().workItems, 1);
});

test('adding a budget does not change existing instrumentation behaviour', () => {
  const session = createSession({ budget: { maxWorkItems: 1 } });
  session.recordContextLoad('_template', ['strategy']);
  session.enterDelegation('research');
  const summary = session.summary();
  assert.equal(summary.contextSectionsLoaded, 1);
  assert.equal(summary.delegationDepth, 1);
  assert.equal(summary.specialistDelegationCount, 1);
});
