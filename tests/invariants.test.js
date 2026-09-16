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
import { getBoundedContext, loadProductContext } from '../runtime/context.js';
import { resolveProductRepository } from '../runtime/productRegistry.js';
import { createDecision, setRecommendation, recordFounderDecision } from '../runtime/decision.js';
import { pdmStatement, evaluateChallengeGate } from '../runtime/pdmCore.js';
import { createSession } from '../runtime/instrumentation.js';
import { selectCapability } from '../runtime/orchestrator.js';
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

// 2b. Same boundary, product side: resolving/reading a git_remote product
// must never itself trigger a sync. Syncing is a deliberate, separate,
// HH-initiated maintenance action (runtime/productSync.js).
const IMPORTS_PRODUCT_SYNC = /from\s+['"]\.\/productSync\.js['"]/;

test('invariant: orchestrator never imports the product-sync module', () => {
  const orchestratorSrc = readFileSync(path.join(RUNTIME_DIR, 'orchestrator.js'), 'utf8');
  assert.doesNotMatch(orchestratorSrc, IMPORTS_PRODUCT_SYNC);
});

test('invariant: context.js and workState.js never import the product-sync module', () => {
  for (const file of ['context.js', 'workState.js']) {
    const src = readFileSync(path.join(RUNTIME_DIR, file), 'utf8');
    assert.doesNotMatch(src, IMPORTS_PRODUCT_SYNC, `${file} should not import productSync.js`);
  }
});

test('invariant: organizationContext.js never imports the product-sync module', () => {
  const src = readFileSync(path.join(RUNTIME_DIR, 'organizationContext.js'), 'utf8');
  assert.doesNotMatch(src, IMPORTS_PRODUCT_SYNC);
});

// 2c. Organization Context is resolved after product selection, for the
// sections a work unit needs — never during the cheap portfolio refresh
// pass (docs/proposals/organization-context-layer.md §2.3, approved
// 2026-09-16). Mirrors the existing "portfolio.js never loads a full
// Product Context" invariant in tests/portfolio.test.js.
test('invariant: portfolio.js never imports organizationContext.js', () => {
  const portfolioSrc = readFileSync(path.join(RUNTIME_DIR, 'portfolio.js'), 'utf8');
  assert.doesNotMatch(portfolioSrc, /from\s+['"]\.\/organizationContext\.js['"]/);
});

test('invariant: orchestrator never imports organizationContext.js', () => {
  const orchestratorSrc = readFileSync(path.join(RUNTIME_DIR, 'orchestrator.js'), 'utf8');
  assert.doesNotMatch(orchestratorSrc, /from\s+['"]\.\/organizationContext\.js['"]/);
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

// Ownership model: Product Context lives in each product's own repository,
// resolved on demand via the Product Registry — never scanned, never
// centrally copied into this repo.
test('invariant: product resolution is a registry lookup, not a directory scan', () => {
  const contextSrc = readFileSync(path.join(RUNTIME_DIR, 'context.js'), 'utf8');
  const productRegistrySrc = readFileSync(path.join(RUNTIME_DIR, 'productRegistry.js'), 'utf8');
  assert.doesNotMatch(contextSrc, /readdirSync/);
  assert.doesNotMatch(productRegistrySrc, /readdirSync/);
});

test('invariant: an unregistered product cannot be resolved, even if a same-named folder exists', () => {
  assert.throws(() => loadProductContext('some-folder-that-is-not-registered'));
});

test('invariant: Product Registry resolves a product to its own repository path, not a hardcoded PDM-repo path', () => {
  const resolved = resolveProductRepository('_template');
  assert.equal(resolved.repositoryType, 'local_path');
  assert.match(resolved.repositoryPath, /products[\\/]_template$/);
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

// Capability selection must be anchored to the dominant uncertainty, not
// merely to intent/stage/keyword matching.
test('invariant: capability selection requires an explicit dominant uncertainty', () => {
  const session = createSession();
  assert.throws(() => selectCapability({ intents: ['prioritization'], decisionStage: 'prioritize' }, session));
  const result = selectCapability(
    { dominantUncertainty: 'unclear which option to do first', intents: ['prioritization'], decisionStage: 'prioritize' },
    session
  );
  assert.equal(result.dominantUncertainty, 'unclear which option to do first');
});

// 6. PDM can disagree with HH.
test('invariant: PDM can issue "disagree" and "dont_build_yet" without being forced to agree', () => {
  assert.equal(pdmStatement('disagree', 'evidence is too weak').kind, 'disagree');
  assert.equal(pdmStatement('dont_build_yet', 'discovery not done').kind, 'dont_build_yet');
  const gate = evaluateChallengeGate({ evidence_mismatch: true, opportunity_cost: true });
  assert.equal(gate.shouldChallenge, true);
});

// 7. PDM does not silently self-modify.
test('invariant: PDM Core, registry, product registry, decision, and evaluation never write to disk (governance/methodology/registry are never auto-mutated)', () => {
  // Three modules are intentional exceptions, and only via explicit calls:
  // context.js (writeProductContext) and workState.js (writeWorkState /
  // writeActiveBrief) write a PRODUCT's own data back to that product's
  // repository, and portfolio.js (writePortfolioIndex) writes a derived,
  // disposable index. None of them modifies PDM governance or methodology,
  // which is what this invariant protects.
  const mustNeverWrite = [
    'pdmCore.js',
    'registry.js',
    'productRegistry.js',
    'decision.js',
    'evaluation.js',
    'instrumentation.js',
    'methodologyEvolution.js',
    'orchestrator.js',
    'productSync.js',
  ];
  for (const { file, text } of runtimeSourceFiles()) {
    if (!mustNeverWrite.includes(file)) continue;
    assert.doesNotMatch(text, /writeFileSync|createWriteStream|fs\.write\(/, `${file} should not write to disk automatically`);
  }
});

test('invariant: writeProductContext only ever writes inside the resolved product repository, never elsewhere', () => {
  const contextSrc = readFileSync(path.join(RUNTIME_DIR, 'context.js'), 'utf8');
  // The write path must go through resolveProductRepository()'s result, not
  // a hardcoded or PDM-repo-relative path.
  assert.match(contextSrc, /writeFileSync\(\s*contextPath/);
  assert.match(contextSrc, /resolveProductRepository\(productId\)/);
});

test('invariant: writeWorkState only ever writes inside the resolved product repository, never elsewhere', () => {
  const workStateSrc = readFileSync(path.join(RUNTIME_DIR, 'workState.js'), 'utf8');
  assert.match(workStateSrc, /writeFileSync\(\s*workStatePath/);
  assert.match(workStateSrc, /resolveProductRepository\(productId\)/);
});

// Work State must never assert a decision on its own authority — it may
// only reference a Product Context decision id, never restate content.
// renderActiveBrief has no field to read decision *content* from, so the
// only way a decision's substance reaches the brief is via Product Context
// (passed in explicitly by the caller), not via Work State's decision_refs.
test('invariant: renderActiveBrief cannot surface decision content from Work State alone', async () => {
  const { renderActiveBrief } = await import('../runtime/workState.js');
  const ws = {
    current_focus: 'x',
    dominant_uncertainty: 'y',
    in_progress: [],
    next_actions: [],
    blocked: [],
    recently_completed: [],
    open_questions: [],
    last_session: { date: '2026-09-11', summary: 's', decision_refs: ['dec_1'] },
  };
  const brief = renderActiveBrief(ws);
  assert.match(brief, /- dec_1/);
  assert.doesNotMatch(brief, /decision_refs/);
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
