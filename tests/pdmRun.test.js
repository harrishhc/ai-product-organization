import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(REPO, 'bin', 'pdm-run.mjs');
const run = (...args) => spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8' });

// `status` and `next` rewrite portfolio-index.md at a path fixed relative to the
// code, and read whichever product clones this machine happens to have. Run
// against a throwaway copy whose registry lists only the chosen fixtures, so the
// real index is never touched and the result does not depend on real products.
function hermeticTree(t, productIds) {
  const root = mkdtempSync(path.join(tmpdir(), 'pdm-run-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const rel of ['bin', 'runtime', 'products', 'package.json']) {
    cpSync(path.join(REPO, rel), path.join(root, rel), { recursive: true });
  }
  mkdirSync(path.join(root, 'methodology'));
  cpSync(path.join(REPO, 'methodology', 'registry'), path.join(root, 'methodology', 'registry'), { recursive: true });
  const registryPath = path.join(root, 'products', 'registry.json');
  const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
  registry.products = Object.fromEntries(productIds.map((id) => [id, { ...registry.products[id], status: 'active' }]));
  writeFileSync(registryPath, JSON.stringify(registry));
  return {
    run: (...args) => spawnSync(process.execPath, [path.join(root, 'bin', 'pdm-run.mjs'), ...args], { encoding: 'utf8' }),
    indexPath: path.join(root, 'portfolio-index.md'),
  };
}

const MIXED = ['_pf-ready-a', '_pf-ready-c', '_pf-waiting', '_pf-blocked', '_pf-idle'];
const NOTHING_RUNNABLE = ['_pf-waiting', '_pf-blocked', '_pf-idle'];
const REAL_INDEX = path.join(REPO, 'portfolio-index.md');
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
  const realIndexBefore = readFileSync(REAL_INDEX, 'utf8');
  const tree = hermeticTree(t, MIXED);
  const r = tree.run('status');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Portfolio \(5 products\)/);
  assert.match(r.stdout, /\[READY\s*\] p2 _pf-ready-a — Draft PRD section 1/);
  assert.match(r.stdout, /\[WAITING_FOR_FOUNDER\] p1 _pf-waiting — awaiting HH: dec_pending_1/);
  assert.match(r.stdout, /\[BLOCKED\s*\] p1 _pf-blocked — Data team export not delivered/);
  assert.match(r.stdout, /Next selected work: _pf-ready-c/, 'priority 1 outranks the other READY product at priority 2');
  assert.match(readFileSync(tree.indexPath, 'utf8'), /# Portfolio Index/, 'status refreshes the derived index');
  assert.equal(readFileSync(REAL_INDEX, 'utf8'), realIndexBefore, 'the test must not touch the real portfolio-index.md');
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
  assert.match(r.stdout, /Delegation: /);
  assert.match(r.stdout, /--- Methodology routing \(shortlist from /);
  assert.match(r.stdout, /then re-run: node bin\/pdm-run\.mjs next --done 3/);
});

test('next stops when the work-item budget is spent, before it reads or writes anything', (t) => {
  const tree = hermeticTree(t, MIXED);
  const r = tree.run('next', '--done', '1', '--max-work-items', '1');
  assert.equal(r.status, 0, r.stderr);
  const stop = JSON.parse(r.stdout);
  assert.equal(stop.action, 'stop');
  assert.equal(stop.reason, 'work_items_exhausted');
  assert.equal(stop.workItemsDone, 1);
  assert.equal(existsSync(tree.indexPath), false, 'a governor stop must not refresh the index');
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
  const r = hermeticTree(t, NOTHING_RUNNABLE).run('route', '--uncertainty', 'qqqq zzzz');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Routing: "qqqq zzzz" \(ad hoc\)/);
  assert.match(r.stdout, /No entrypoint matched\. That is no signal, not a weak one/);
});

test('an unknown command prints usage and exits 2', () => {
  const r = run('frobnicate');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /Usage:[\s\S]*pdm-run\.mjs status[\s\S]*pdm-run\.mjs next[\s\S]*pdm-run\.mjs route/);
});
