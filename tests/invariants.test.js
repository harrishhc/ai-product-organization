// Tests for the ten architectural invariants called out in the bootstrap
// task. Several are static-source checks rather than behavioral checks,
// because they are structural guarantees (e.g. "this module is never
// imported by that module") rather than runtime outputs.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { filterCandidates, loadCapabilityDetail } from '../runtime/registry.js';
import { getBoundedContext } from '../runtime/context.js';
import { createDecision, setRecommendation, recordFounderDecision } from '../runtime/decision.js';
import { pdmStatement, evaluateChallengeGate } from '../runtime/pdmCore.js';
import { createSession } from '../runtime/instrumentation.js';
import { reviewExternalMethodology, requiresExplicitApproval } from '../runtime/methodologyEvolution.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RUNTIME_DIR = path.join(__dirname, '..', 'runtime');

function runtimeSourceFiles() {
  return readdirSync(RUNTIME_DIR)
    .filter((f) => f.endsWith('.js'))
    .map((f) => ({ file: f, text: readFileSync(path.join(RUNTIME_DIR, f), 'utf8') }));
}

// 1. Runtime works without external methodology network access.
test('invariant: no runtime module performs network I/O directly', () => {
  const networkPatterns = [/\bfetch\(/, /https?\.request\(/, /XMLHttpRequest/, /net\.connect\(/];
  for (const { file, text } of runtimeSourceFiles()) {
    for (const pattern of networkPatterns) {
      assert.doesNotMatch(text, pattern, `${file} appears to perform network I/O directly (matched ${pattern})`);
    }
  }
});

test('invariant: an ordinary end-to-end pass needs no network call', () => {
  const session = createSession();
  const { selected } = filterCandidates({ intents: ['problem_framing'] }).length
    ? { selected: filterCandidates({ intents: ['problem_framing'] })[0] }
    : { selected: null };
  loadCapabilityDetail(selected.id);
  getBoundedContext('_template', ['strategy']);
  assert.equal(session.summary().networkCalls, 0);
});

// 2. External upstream changes do not automatically change runtime behavior.
const IMPORTS_METHODOLOGY_EVOLUTION = /from\s+['"]\.\/methodologyEvolution\.js['"]/;

test('invariant: orchestrator never imports the methodology-evolution module', () => {
  const orchestratorSrc = readFileSync(path.join(RUNTIME_DIR, 'orchestrator.js'), 'utf8');
  assert.doesNotMatch(orchestratorSrc, IMPORTS_METHODOLOGY_EVOLUTION);
});

test('invariant: registry.js never imports the methodology-evolution module', () => {
  const registrySrc = readFileSync(path.join(RUNTIME_DIR, 'registry.js'), 'utf8');
  assert.doesNotMatch(registrySrc, IMPORTS_METHODOLOGY_EVOLUTION);
});

// 3. Registry routing does not require loading every capability.
test('invariant: selecting a candidate does not load any capability detail file', () => {
  const session = createSession();
  filterCandidates({ intents: ['prd', 'execution_gate'] });
  assert.equal(session.summary().capabilityDetailLoads, 0);
});

test('invariant: loading one capability does not load the others', () => {
  const session = createSession();
  const { detail } = loadCapabilityDetail('discovery-question-set');
  session.recordCapabilityDetailLoad('discovery-question-set', detail);
  assert.equal(session.summary().capabilityDetailLoads, 1);
});

// 4. Product Context does not leak into reusable methodology.
test('invariant: PDM Core / registry / decision / evaluation modules never reference the products/ directory', () => {
  const guarded = ['pdmCore.js', 'registry.js', 'decision.js', 'evaluation.js', 'instrumentation.js', 'methodologyEvolution.js'];
  for (const { file, text } of runtimeSourceFiles()) {
    if (!guarded.includes(file)) continue;
    assert.doesNotMatch(text, /products\//i, `${file} should not reference the products/ directory directly`);
  }
});

test('invariant: methodology registry entries carry no product-specific fields', () => {
  const registryPath = path.join(__dirname, '..', 'methodology', 'registry', 'registry.json');
  const text = readFileSync(registryPath, 'utf8');
  assert.doesNotMatch(text, /product_id/);
});

// 5. PDM recommendation is distinct from HH decision.
test('invariant: recommendation and founder_decision remain separate fields after an override', () => {
  let d = createDecision({ context: 'c', problem: 'p' });
  d = setRecommendation({ ...d, state: 'FRAMING' }, { recommendation: 'A', confidence: 'high' });
  d = recordFounderDecision(d, { hhDecision: 'B', isOverride: true });
  assert.notEqual(d.recommendation, d.founder_decision.hhDecision);
  assert.equal(d.recommendation, 'A');
  assert.equal(d.founder_decision.hhDecision, 'B');
});

// 6. PDM can disagree with HH.
test('invariant: PDM can issue "disagree" and "dont_build_yet" without being forced to agree', () => {
  assert.equal(pdmStatement('disagree', 'evidence is too weak').kind, 'disagree');
  assert.equal(pdmStatement('dont_build_yet', 'discovery not done').kind, 'dont_build_yet');
  const gate = evaluateChallengeGate({ evidence_mismatch: true, opportunity_cost: true });
  assert.equal(gate.shouldChallenge, true);
});

// 7. PDM does not silently self-modify.
test('invariant: no runtime module writes to disk (governance/methodology/registry are never auto-mutated)', () => {
  for (const { file, text } of runtimeSourceFiles()) {
    assert.doesNotMatch(text, /writeFileSync|createWriteStream|fs\.write\(/, `${file} should not write to disk automatically`);
  }
});

// 8. Specialist delegation has a bounded purpose.
test('invariant: methodologyEvolution requires explicit HH initiation and an injected fetcher', async () => {
  await assert.rejects(() => reviewExternalMethodology({ initiatedByHH: false, fetchUpstream: async () => ({}) }));
  // missing fetchUpstream entirely: the function is `async`, so the thrown
  // error surfaces as a rejected promise, not a synchronous throw.
  await assert.rejects(() => reviewExternalMethodology({ initiatedByHH: true }));
});

test('invariant: only governance-gated stages require explicit approval', () => {
  assert.equal(requiresExplicitApproval('DIFF'), false);
  assert.equal(requiresExplicitApproval('HH_APPROVAL'), true);
  assert.equal(requiresExplicitApproval('UPDATE_REGISTRY'), true);
});

// 9. Context loading is bounded. (see also tests/context.test.js)
test('invariant: bounded context never returns unrequested sections', () => {
  const ctx = getBoundedContext('_template', ['roadmap']);
  assert.deepEqual(Object.keys(ctx).sort(), ['product_id', 'roadmap']);
});

// 10. Methodology changes require explicit governance.
test('invariant: a fetched upstream snapshot does not itself alter the approved registry', async () => {
  const result = await reviewExternalMethodology({
    initiatedByHH: true,
    fetchUpstream: async () => ({ fakeUpstreamCapability: 'new-skill' }),
  });
  assert.equal(result.stage, 'FETCH_REVIEW');
  // The live registry must be unaffected by merely fetching a snapshot.
  const candidates = filterCandidates({ intents: ['prioritization'] });
  assert.ok(candidates.every((c) => c.id !== 'new-skill'));
});
