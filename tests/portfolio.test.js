import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, rmSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  refreshPortfolio,
  deriveWorkStatus,
  rankRunnableWork,
  selectNextWork,
  renderPortfolioIndex,
  writePortfolioIndex,
  PORTFOLIO_INDEX_PATH,
} from '../runtime/portfolio.js';
import { createSession } from '../runtime/instrumentation.js';

const RUNTIME_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'runtime');
const FIXTURES = ['_pf-ready-a', '_pf-ready-b', '_pf-ready-c', '_pf-blocked', '_pf-waiting', '_pf-idle'];
const byId = (portfolio, id) => portfolio.find((e) => e.productId === id);

test('status is derived from the product\'s own work state and checkpoints', () => {
  assert.equal(deriveWorkStatus({ workState: { next_actions: ['x'] }, pendingCheckpoints: [] }), 'READY');
  assert.equal(deriveWorkStatus({ workState: { blocked: ['y'], next_actions: ['x'] }, pendingCheckpoints: [] }), 'BLOCKED');
  assert.equal(deriveWorkStatus({ workState: { next_actions: [] }, pendingCheckpoints: [] }), 'IDLE');
});

test('a pending checkpoint outranks a blocker: name the person who can unblock it', () => {
  const status = deriveWorkStatus({ workState: { blocked: ['vendor'], next_actions: ['x'] }, pendingCheckpoints: [{ id: 'dec_1' }] });
  assert.equal(status, 'WAITING_FOR_FOUNDER');
});

test('refreshPortfolio derives each product\'s status from its own state', () => {
  const portfolio = refreshPortfolio({ productIds: FIXTURES });
  assert.equal(byId(portfolio, '_pf-ready-a').status, 'READY');
  assert.equal(byId(portfolio, '_pf-blocked').status, 'BLOCKED');
  assert.equal(byId(portfolio, '_pf-waiting').status, 'WAITING_FOR_FOUNDER');
  assert.equal(byId(portfolio, '_pf-idle').status, 'IDLE');
  assert.deepEqual(byId(portfolio, '_pf-waiting').pendingCheckpointIds, ['dec_pending_1']);
});

test('refreshPortfolio surfaces a product\'s uncertainty_type, and null when it is not recorded', () => {
  const portfolio = refreshPortfolio({ productIds: ['_pf-ready-a', '_pf-ready-b'] });
  assert.equal(byId(portfolio, '_pf-ready-a').uncertaintyType, 'user_need');
  assert.equal(byId(portfolio, '_pf-ready-b').uncertaintyType, null);
});

test('a product that cannot be resolved yet becomes UNINITIALIZED instead of breaking the loop', () => {
  // Uses the dedicated _git-remote-not-cloned-yet fixture, never a real
  // product. This assertion previously pointed at colon-biopsy-ai-app and so
  // passed only while that product happened to be unsynced — meaning the first
  // worker to do its job and sync it broke an architectural invariant test.
  // An invariant must not depend on a real product's transient local state.
  const portfolio = refreshPortfolio({ productIds: ['_git-remote-not-cloned-yet', '_pf-ready-a'] });
  const unsynced = byId(portfolio, '_git-remote-not-cloned-yet');
  assert.equal(unsynced.status, 'UNINITIALIZED');
  assert.match(unsynced.note, /local clone does not exist yet/);
  assert.equal(byId(portfolio, '_pf-ready-a').status, 'READY', 'the other product still refreshed');
});

test('refresh reads one bounded section per product, never a full Product Context', () => {
  const session = createSession();
  refreshPortfolio({ productIds: FIXTURES, session });
  const loads = session.summary().contextLoads;
  assert.ok(loads.length > 0);
  for (const load of loads) assert.deepEqual(load.sections, ['decisions']);
});

test('selection excludes waiting, blocked, idle and uninitialized products', () => {
  const runnable = rankRunnableWork(refreshPortfolio({ productIds: FIXTURES }));
  assert.deepEqual(
    runnable.map((e) => e.productId).sort(),
    ['_pf-ready-a', '_pf-ready-b', '_pf-ready-c']
  );
});

test('priority decides first: the priority-1 product is selected over priority-2 products', () => {
  const selected = selectNextWork(refreshPortfolio({ productIds: FIXTURES }));
  assert.equal(selected.productId, '_pf-ready-c');
  assert.equal(selected.priority, 1);
});

test('equal priority is broken by least-recently-worked, so a product cannot starve', () => {
  const portfolio = refreshPortfolio({ productIds: ['_pf-ready-a', '_pf-ready-b'] });
  const ranked = rankRunnableWork(portfolio);
  assert.equal(ranked[0].productId, '_pf-ready-b', 'last worked 2026-08-01, older than a\'s 2026-09-01');
});

test('nothing runnable is a normal result, not an error', () => {
  assert.equal(selectNextWork(refreshPortfolio({ productIds: ['_pf-waiting', '_pf-blocked', '_pf-idle'] })), null);
});

test('a product waiting on HH does not stop the rest of the portfolio', () => {
  const selected = selectNextWork(refreshPortfolio({ productIds: ['_pf-waiting', '_pf-ready-a'] }));
  assert.equal(selected.productId, '_pf-ready-a');
});

test('the rendered index declares itself derived and separates waiting from blocking', () => {
  const portfolio = refreshPortfolio({ productIds: FIXTURES });
  const markdown = renderPortfolioIndex(portfolio, { selected: selectNextWork(portfolio), generatedAt: '2026-09-13T00:00:00.000Z' });
  assert.match(markdown, /DERIVED FILE/);
  assert.match(markdown, /Do not hand-edit/);
  assert.match(markdown, /## Waiting on HH/);
  assert.match(markdown, /They never stop the loop/);
  assert.match(markdown, /\*\*_pf-ready-c\*\*/);
});

test('writePortfolioIndex writes the derived file at the PDM repo root', () => {
  const existed = existsSync(PORTFOLIO_INDEX_PATH);
  const before = existed ? readFileSync(PORTFOLIO_INDEX_PATH, 'utf8') : null;
  try {
    const { portfolioIndexPath } = writePortfolioIndex('# test\n');
    assert.equal(portfolioIndexPath, PORTFOLIO_INDEX_PATH);
    assert.equal(readFileSync(PORTFOLIO_INDEX_PATH, 'utf8'), '# test\n');
  } finally {
    if (existed) writePortfolioIndex(before);
    else rmSync(PORTFOLIO_INDEX_PATH, { force: true });
  }
});

// Structural invariant, in the style of tests/invariants.test.js: the cheap
// refresh must stay cheap. If portfolio.js ever reaches for a full context,
// a five-product refresh silently becomes the thing Active Brief was built
// to avoid.
test('invariant: portfolio.js never loads a full Product Context', () => {
  const source = readFileSync(path.join(RUNTIME_DIR, 'portfolio.js'), 'utf8');
  assert.doesNotMatch(source, /loadProductContext/);
  assert.doesNotMatch(source, /getBoundedContext/, 'decisions are read via decisionRecord.js, one bounded section');
});
