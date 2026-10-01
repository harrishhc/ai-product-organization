import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describeDelegation } from '../runtime/pdmCore.js';
import { renderRoutingShortlist } from '../runtime/registry.js';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(REPO, 'bin', 'pdm-run.mjs');
const run = (...args) => spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8' });

// `status` and `next` rewrite portfolio-index.md at a path fixed relative to the
// code, and read whichever product clones the machine has. Run against a
// throwaway copy whose registry lists only the chosen fixtures, so the real
// index is never touched and the result does not depend on real products.
// Only registry.json and the chosen products/<id> are copied: other test files
// create and delete files under products/_template while this one runs, and
// copying the whole directory raced with them (ENOENT).
function hermeticTree(t, productIds) {
  const root = mkdtempSync(path.join(tmpdir(), 'pdm-run-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const rel of ['bin', 'runtime', 'package.json']) {
    cpSync(path.join(REPO, rel), path.join(root, rel), { recursive: true });
  }
  mkdirSync(path.join(root, 'products'));
  const registry = JSON.parse(readFileSync(path.join(REPO, 'products', 'registry.json'), 'utf8'));
  registry.products = Object.fromEntries(productIds.map((id) => [id, { ...registry.products[id], status: 'active' }]));
  writeFileSync(path.join(root, 'products', 'registry.json'), JSON.stringify(registry));
  for (const id of productIds) {
    cpSync(path.join(REPO, 'products', id), path.join(root, 'products', id), { recursive: true });
  }
  mkdirSync(path.join(root, 'methodology'));
  cpSync(path.join(REPO, 'methodology', 'registry'), path.join(root, 'methodology', 'registry'), { recursive: true });
  return {
    run: (...args) => spawnSync(process.execPath, [path.join(root, 'bin', 'pdm-run.mjs'), ...args], { encoding: 'utf8' }),
    indexPath: path.join(root, 'portfolio-index.md'),
    productPath: (id, file) => path.join(root, 'products', id, file),
  };
}

const MIXED = ['_pf-ready-a', '_pf-ready-c', '_pf-waiting', '_pf-blocked', '_pf-idle'];
const NOTHING_RUNNABLE = ['_pf-waiting', '_pf-blocked', '_pf-idle'];
const firstJsonObject = (stdout) => JSON.parse(stdout.slice(0, stdout.indexOf('\n}') + 2));

test('a flag with a missing, empty or flag-like value is refused instead of swallowing the next argument', () => {
  for (const args of [
    ['route', '--uncertainty'],
    ['route', '--uncertainty', ''],
    ['route', '--intents'],
    ['route', '--type'],
    ['route', '--stage', '--spans-stages'],
    ['next', '--done'],
  ]) {
    const r = run(...args);
    assert.equal(r.status, 2, `${args.join(' ')} should exit 2`);
    assert.match(r.stderr, /needs a value/);
  }
});

test('numeric flags reject non-integers rather than turning into NaN', () => {
  for (const bad of ['abc', '-1', '1.5']) {
    const r = run('next', '--done', bad);
    assert.equal(r.status, 2, `--done ${bad} should exit 2`);
    assert.match(r.stderr, /non-negative integer/);
  }
});

test('route accepts an ad hoc uncertainty and an inline --flag=value form', () => {
  const r = run('route', '--uncertainty=which buyer signs off', '--intents=prd');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Routing: "which buyer signs off" \(ad hoc\)/);
});

test('route rejects a token outside the closed vocabulary with a clear error', () => {
  const r = run('route', '--uncertainty', 'q', '--type', 'the buyer is unknown');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /Unknown uncertaintyType/);
});

test('status prints every product with its state and names the work `next` would pick', (t) => {
  const tree = hermeticTree(t, MIXED);
  const r = tree.run('status');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Portfolio \(5 products\)/);
  assert.match(r.stdout, /\[READY\s*\] p2 _pf-ready-a — Draft PRD section 1/);
  assert.match(r.stdout, /\[WAITING_FOR_FOUNDER\] p1 _pf-waiting — awaiting HH: dec_pending_1/);
  assert.match(r.stdout, /\[BLOCKED\s*\] p1 _pf-blocked — Data team export not delivered/);
  assert.match(r.stdout, /Next selected work: _pf-ready-c/, 'priority 1 outranks the other READY product at priority 2');
  assert.match(readFileSync(tree.indexPath, 'utf8'), /# Portfolio Index/, 'status refreshes the derived index');
});

test('status says so when nothing is runnable', (t) => {
  const r = hermeticTree(t, NOTHING_RUNNABLE).run('status');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Next selected work: \(nothing runnable\)/);
});

test('next hands back the selected product, its shortlist and the command that continues the loop', (t) => {
  const r = hermeticTree(t, MIXED).run('next', '--done', '2');
  assert.equal(r.status, 0, r.stderr);
  const work = firstJsonObject(r.stdout);
  assert.equal(work.action, 'work');
  assert.equal(work.productId, '_pf-ready-c');
  assert.equal(work.priority, 1);
  assert.equal(work.workItemsDone, 2);
  assert.match(work.activeBriefPath, /_pf-ready-c[\\/]active-brief\.md$/);
  assert.match(r.stdout, /Delegation: uncertainty_type not set/);
  assert.doesNotMatch(r.stdout, /--- Active Brief ---/, 'no active-brief.md on file, so no brief section');
  assert.match(r.stdout, /--- Methodology routing \(shortlist from /);
  assert.match(r.stdout, /then re-run: node bin\/pdm-run\.mjs next --done 3/);
});

test('next stops when the work-item budget is spent, without refreshing the index', (t) => {
  const tree = hermeticTree(t, MIXED);
  const r = tree.run('next', '--done', '1', '--max-work-items', '1');
  assert.equal(r.status, 0, r.stderr);
  const stop = JSON.parse(r.stdout);
  assert.equal(stop.action, 'stop');
  assert.equal(stop.reason, 'work_items_exhausted');
  assert.equal(stop.workItemsDone, 1);
  assert.equal(existsSync(tree.indexPath), false, 'the governor check runs before the refresh that writes the index');
});

test('next stops with the products waiting on HH when nothing is runnable', (t) => {
  const r = hermeticTree(t, NOTHING_RUNNABLE).run('next');
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout), {
    action: 'stop',
    reason: 'no_runnable_work',
    waitingForFounder: ['_pf-waiting'],
    workItemsDone: 0,
  });
});

test('route with no uncertainty on file and none supplied refuses instead of guessing', (t) => {
  const r = hermeticTree(t, NOTHING_RUNNABLE).run('route');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /route needs an uncertainty: pass --uncertainty/);
});

test('route reports no signal, not a weak one, when nothing matches', (t) => {
  const tree = hermeticTree(t, NOTHING_RUNNABLE);
  const r = tree.run('route', '--uncertainty', 'qqqq zzzz');
  assert.equal(r.status, 0, r.stderr);
  assert.equal(existsSync(tree.indexPath), false, 'route is a read-only query and must not write the index');
  assert.match(r.stdout, /Routing: "qqqq zzzz" \(ad hoc\)/);
  assert.match(r.stdout, /No entrypoint matched\. That is no signal, not a weak one/);
});

test('next reports the selected product\'s own fields, its Active Brief, a delegation hint and a shortlist routed on its dominant uncertainty', (t) => {
  const tree = hermeticTree(t, ['_pf-ready-a']);
  writeFileSync(tree.productPath('_pf-ready-a', 'active-brief.md'), '# Brief for ready-a\nBRIEF-BODY-MARKER\n');
  const r = tree.run('next');
  assert.equal(r.status, 0, r.stderr);
  const work = firstJsonObject(r.stdout);
  assert.equal(work.nextAction, 'Draft PRD section 1');
  assert.equal(work.remainingNextActions, 1);
  assert.equal(work.dominantUncertainty, 'Which buyer signs off');
  assert.match(r.stdout, /--- Active Brief ---\n# Brief for ready-a\nBRIEF-BODY-MARKER/);
  assert.ok(r.stdout.includes(`Delegation: ${describeDelegation('user_need')}`), 'the fixture declares uncertainty_type user_need');
  const expectedShortlist = renderRoutingShortlist('Which buyer signs off', [], 'user_need').join('\n');
  assert.ok(r.stdout.includes(expectedShortlist), 'the shortlist must be routed on dominant_uncertainty, not another field');
});

test('route with no flags routes the on-file uncertainty and routing_intents, and writes nothing', (t) => {
  const tree = hermeticTree(t, ['_pf-ready-a']);
  const stateFile = tree.productPath('_pf-ready-a', 'work-state.json');
  const state = JSON.parse(readFileSync(stateFile, 'utf8'));
  writeFileSync(stateFile, JSON.stringify({ ...state, routing_intents: ['prd'] }));

  const body = (r) => r.stdout.split('\n').slice(1).join('\n');
  const onFile = tree.run('route');
  assert.equal(onFile.status, 0, onFile.stderr);
  assert.match(onFile.stdout.split('\n')[0], /^Routing: "Which buyer signs off" \(on file for _pf-ready-a\)$/);

  const sameIntents = tree.run('route', '--uncertainty', 'Which buyer signs off', '--intents', 'prd');
  const noIntents = tree.run('route', '--uncertainty', 'Which buyer signs off');
  assert.notEqual(body(sameIntents), body(noIntents), 'precondition: the intents change the result');
  assert.equal(body(onFile), body(sameIntents), 'the on-file routing_intents must be used');
  assert.equal(existsSync(tree.indexPath), false, 'route is a read-only query and must not write the index');
});

test('an unknown command prints usage and exits 2', () => {
  const r = run('frobnicate');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /Usage:[\s\S]*pdm-run\.mjs status[\s\S]*pdm-run\.mjs next[\s\S]*pdm-run\.mjs route/);
});
