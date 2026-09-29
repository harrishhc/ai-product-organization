import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  runStage,
  selectCapability,
  loadSelectedCapability,
  resolveSelectedComposition,
  retrieveContext,
  delegateToSpecialist,
  completeDelegation,
  delegationBudgetRemaining,
} from '../runtime/orchestrator.js';
import { createSession, MAX_DELEGATION_DEPTH } from '../runtime/instrumentation.js';

test('runStage rejects a stage name outside the twelve-stage loop', () => {
  const session = createSession();
  assert.throws(() => runStage('INVENT_A_STAGE', session));
});

test('a minimal interaction can skip most of the twelve-stage loop', () => {
  const session = createSession();
  runStage('LISTEN', session);
  runStage('DECIDE', session);
  assert.equal(session.summary().toolCalls, 2);
});

test('end-to-end: select a capability, load only its detail, retrieve bounded context', () => {
  const session = createSession();
  const { selected } = selectCapability(
    { dominantUncertainty: 'unclear which option to do first', intents: ['prioritization'], decisionStage: 'prioritize' },
    session
  );
  assert.equal(selected.id, 'capabilities:prioritization-comparison');

  const { detail } = loadSelectedCapability(selected, session);
  assert.match(detail, /Prioritization Comparison/);
  assert.equal(session.summary().capabilityDetailLoads, 1);

  const ctx = retrieveContext('_template', ['strategy'], session);
  assert.ok('strategy' in ctx);
  assert.equal(session.summary().contextSectionsLoaded, 1);
});

test('selectCapability refuses to route without an explicit dominant uncertainty', () => {
  const session = createSession();
  assert.throws(() => selectCapability({ intents: ['prioritization'], decisionStage: 'prioritize' }, session));
});

test('selectCapability refuses an uncertaintyType outside the closed vocabulary rather than silently ignoring it', () => {
  assert.throws(
    () => selectCapability({ dominantUncertainty: 'q', uncertaintyType: 'the buyer is unknown', intents: ['prd'] }),
    /Unknown uncertaintyType/,
  );
  assert.doesNotThrow(() => selectCapability({ dominantUncertainty: 'q', uncertaintyType: 'workflow', intents: ['prd'] }));
});

test('delegation requires an explicit question, output, and decision it informs', () => {
  const session = createSession();
  assert.throws(() => delegateToSpecialist({ dominantUncertaintyType: 'user_need' }, session));
});

test('delegation depth is bounded and enforced', () => {
  const session = createSession();
  for (let i = 0; i < MAX_DELEGATION_DEPTH; i += 1) {
    delegateToSpecialist(
      { dominantUncertaintyType: 'user_need', question: 'q', expectedOutput: 'o', decisionInformed: 'd' },
      session
    );
  }
  assert.equal(delegationBudgetRemaining(session), 0);
  assert.throws(() =>
    delegateToSpecialist(
      { dominantUncertaintyType: 'user_need', question: 'q', expectedOutput: 'o', decisionInformed: 'd' },
      session
    )
  );
});

test('completing a delegation frees budget for the next one', () => {
  const session = createSession();
  delegateToSpecialist(
    { dominantUncertaintyType: 'user_need', question: 'q', expectedOutput: 'o', decisionInformed: 'd' },
    session
  );
  completeDelegation(session);
  assert.equal(session.summary().delegationDepth, 0);
  assert.equal(session.summary().specialistDelegationCount, 1);
});

test('delegating for an unmapped uncertainty type is refused rather than guessed', () => {
  const session = createSession();
  assert.throws(() =>
    delegateToSpecialist(
      { dominantUncertaintyType: 'totally_unknown', question: 'q', expectedOutput: 'o', decisionInformed: 'd' },
      session
    )
  );
});

test('end-to-end: a composed work unit resolves its sequence before loading any detail', () => {
  const session = createSession();
  const { selected } = selectCapability(
    {
      dominantUncertainty: 'discovery notes exist but no engineering-ready requirements document',
      intents: ['prd'],
      decisionStage: 'document',
      spansMultipleStages: true,
    },
    session
  );
  assert.equal(selected.id, 'skills:prd-development');

  const { composedBy } = resolveSelectedComposition(selected, session);
  assert.equal(composedBy[0].id, 'commands:write-prd');
  assert.ok(composedBy[0].siblings.includes('skills:problem-statement'));
  // Resolving the composition must cost no capability detail.
  assert.equal(session.summary().capabilityDetailLoads, 0);

  // PDM then loads only the members this work unit needs.
  loadSelectedCapability({ id: composedBy[0].siblings[0] }, session);
  assert.equal(session.summary().capabilityDetailLoads, 1);
});

test('resolveSelectedComposition refuses a missing selection rather than guessing', () => {
  const session = createSession();
  assert.throws(() => resolveSelectedComposition(null, session));
});
