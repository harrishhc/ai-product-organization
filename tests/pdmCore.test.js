import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  pdmStatement,
  FIVE_STATEMENTS,
  evaluateChallengeGate,
  founderOverride,
  requiresHhApproval,
  selectDelegate,
  describeDelegation,
  UNCERTAINTY_TYPES,
} from '../runtime/pdmCore.js';

test('pdmStatement accepts all five constitutional statements', () => {
  for (const kind of FIVE_STATEMENTS) {
    const stmt = pdmStatement(kind, 'detail');
    assert.equal(stmt.kind, kind);
  }
});

test('pdmStatement rejects unknown statement kinds', () => {
  assert.throws(() => pdmStatement('shrug', 'x'));
});

test('evaluateChallengeGate is silent when no dimension is triggered', () => {
  const result = evaluateChallengeGate({});
  assert.equal(result.shouldChallenge, false);
});

test('evaluateChallengeGate flags irreversibility as blocking', () => {
  const result = evaluateChallengeGate({ irreversibility: true });
  assert.equal(result.shouldChallenge, true);
  assert.equal(result.severity, 'blocking');
});

test('evaluateChallengeGate treats a single non-blocking dimension as advisory', () => {
  const result = evaluateChallengeGate({ scope_inflation: true });
  assert.equal(result.severity, 'advisory');
});

test('founderOverride preserves that PDM still disagrees', () => {
  const override = founderOverride({
    pdmRecommendation: 'do_not_build',
    hhDecision: 'build_now',
    preservedAssumptions: ['assumed demand exists'],
  });
  assert.equal(override.pdmStillDisagrees, true);
  assert.deepEqual(override.preservedAssumptions, ['assumed demand exists']);
});

test('required-approval areas are correctly flagged', () => {
  assert.equal(requiresHhApproval('irreversible_strategic_decisions'), true);
  assert.equal(requiresHhApproval('product_methodology_workflow'), false);
});

test('selectDelegate maps uncertainty types to the correct specialist', () => {
  assert.equal(selectDelegate('user_need'), 'research');
  assert.equal(selectDelegate('interaction'), 'design');
  assert.equal(selectDelegate('reliability'), 'qa');
  assert.equal(selectDelegate('implementation'), 'engineering');
  assert.equal(selectDelegate('totally_unknown_type'), null);
});

test('UNCERTAINTY_TYPES is exactly the set selectDelegate can map', () => {
  assert.equal(UNCERTAINTY_TYPES.length, 12);
  for (const t of UNCERTAINTY_TYPES) assert.ok(selectDelegate(t), `${t} must map to a specialist`);
});

test('describeDelegation names the specialist and its gate, or says none applies, or says the type is unset', () => {
  assert.match(describeDelegation('user_need'), /delegate to "research".*users, needs/);
  assert.match(describeDelegation(null), /uncertainty_type not set/);
  assert.match(describeDelegation(undefined), /user_need/, 'the unset hint lists the valid tokens');
  assert.match(describeDelegation('made_up'), /no specialist mapped; resolve within PDM/);
});
